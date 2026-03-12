
package UltraKibanaDownloader;
import javax.swing.*;
import javax.swing.text.*;

import UltraKibanaDownloader.components.AutoCompleteTextField;

import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.Date;
import java.util.Calendar;
import java.text.SimpleDateFormat;
import java.net.URISyntaxException;
// Removed LinkedHashSet (no longer used after switching to replacement strategy for services block)
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
// Removed unused java.nio.file imports after switching to module execution

import UltraKibanaDownloader.model.Configuration;

public class UltraKibanaDownloader {

    // UI Components
    private JFrame frame;
    private JTextField dateField;
    private AutoCompleteTextField logsField;
    private JTextField timeRangeField;
    private JComboBox<String> timeUnitComboBox;
    private JComboBox<String> timeDirectionComboBox;
    private JTextField excludeField;
    private JTextField includeField;
    private JLabel includeLabel;  // kept as field for dynamic keyword-count update
    private JLabel excludeLabel;
    // Kibana environment now fixed to OnCloud; combo removed
    private JComboBox<String> countriesComboBox;
    private JComboBox<String> configComboBox;
    private JComboBox<String> idTypeComboBox;
    private AutoCompleteTextField idField; 
    private JTextPane outputArea;
    private JProgressBar progressBar;
    private JLabel statusLabel;
    private JButton downloadButton; // keep reference for enable/disable
    private JButton stopButton; // initialized in createStatusPanel(); null-checked in showProgress()
    private JButton csvParserButton; // keep reference for disable during tasks
    private JButton configDownloadButton; // keep reference for disable during tasks
    // Trace filter: enabled trace levels (single-letter codes like D, I, W, E)
    private Set<String> enabledTraceLevels;
    private JComboBox<String> traceLevelComboBox;
    private static final Pattern TRACE_LEVEL_PATTERN = Pattern.compile("\\[(D|I|W|E)\\]");
    // Reference to the currently running external process (Python) so we can cancel it
    private volatile Process currentProcess;
    // Request cancellation from UI
    private volatile boolean cancelRequested = false;
    // Cooperative cancellation: path of the signal file that Python polls each scroll iteration
    private static final String CANCEL_SIGNAL_PATH = System.getProperty("java.io.tmpdir") + File.separator + "ukd_cancel.signal";
    // Shared date formatter (used in date field init, Now button, and setCurrentDateTime)
    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    // Services and Model
    private final Configuration configuration;
    private final File projectRoot;
    private static final String USER_SETTINGS_FILE_NAME = "user-settings.properties";
    
    private final ExecutorService executorService = Executors.newFixedThreadPool(2);

    public UltraKibanaDownloader() {
        // Resolve execution root before loading configuration or UI elements
        this.projectRoot = resolveProjectRoot();

        // Initialize services and model
        this.configuration = new Configuration();

        // Load persisted settings (e.g. custom logs directory) before building the UI
        loadUserSettings();

        // Normalize default paths against the resolved project root so logs stay next to the app
        configuration.setLogs(resolveLogsPath(configuration.getLogs()));

        // Initialize trace filter defaults
        this.enabledTraceLevels = new HashSet<>(Arrays.asList("D","I","W","E"));

        // Initialize UI
        initializeUI();
        
        // Load configuration
        loadConfiguration();
        
        // Set current date and time
        setCurrentDateTime();
        
        updateStatus("Ready");
    }

    private void initializeUI() {
        // Create main frame
        frame = new JFrame("Ultra Kibana Traces Downloader");
        frame.setDefaultCloseOperation(JFrame.DO_NOTHING_ON_CLOSE);
        frame.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                Object[] exitOptions = {"Yes", "No"};
                int opt = JOptionPane.showOptionDialog(frame, "Exit and stop any running tasks?", "Confirm Exit",
                        JOptionPane.YES_NO_OPTION, JOptionPane.WARNING_MESSAGE, null, exitOptions, exitOptions[1]);
                if (opt == JOptionPane.YES_OPTION) {
                    shutdownExecutor();
                    frame.dispose();
                    System.exit(0);
                }
            }
        });
        frame.setLayout(new BorderLayout());
        
        // Set optimal size and center on screen
        frame.setSize(1400, 900);
        frame.setLocationRelativeTo(null);
        // Create split pane layout
        JSplitPane mainSplitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        mainSplitPane.setLeftComponent(createControlPanel());
        mainSplitPane.setRightComponent(createOutputPanel());
        mainSplitPane.setResizeWeight(0.0);
        mainSplitPane.setBorder(null);
        
        frame.add(mainSplitPane, BorderLayout.CENTER);
        frame.add(createStatusPanel(), BorderLayout.SOUTH);
        
        frame.setVisible(true);
        // Ensure layout is fully validated after showing to avoid initial tiny field rendering
        SwingUtilities.invokeLater(() -> {
            mainSplitPane.setDividerLocation(500);
            frame.invalidate();
            frame.validate();
            frame.repaint();
        });
    }

    private JPanel createControlPanel() {
        JPanel controlPanel = new JPanel(new BorderLayout());
        controlPanel.setBackground(Color.WHITE);
        controlPanel.setBorder(BorderFactory.createEmptyBorder(20, 20, 20, 10));
        
        // Title
        JLabel title = new JLabel("Configuration");
        title.setFont(new Font("Segoe UI", Font.BOLD, 20));
        title.setForeground(new Color(33, 37, 41));
        title.setBorder(BorderFactory.createEmptyBorder(0, 0, 20, 0));
        controlPanel.add(title, BorderLayout.NORTH);
        
        // Form content
        JPanel formPanel = createCompactFormPanel();
        controlPanel.add(formPanel, BorderLayout.CENTER);
        
        // Buttons
        JPanel buttonPanel = createButtonPanel();
        controlPanel.add(buttonPanel, BorderLayout.SOUTH);
        
        return controlPanel;
    }

    private JPanel createCompactFormPanel() {
        JPanel formPanel = new JPanel(new GridBagLayout());
        formPanel.setBackground(Color.WHITE);
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(5, 5, 5, 5);
        gbc.anchor = GridBagConstraints.WEST;
        Font labelFont = new Font("Segoe UI", Font.PLAIN, 12);

        addIdTypeRow(formPanel, gbc, labelFont);
        addEnterIdRow(formPanel, gbc, labelFont);
        addDateRow(formPanel, gbc, labelFont);
        addTimeWindowRow(formPanel, gbc, labelFont);
        addTimeRangeRow(formPanel, gbc, labelFont);
        addLogsPathRow(formPanel, gbc, labelFont);
        addCountryRow(formPanel, gbc, labelFont);
        addConfigRow(formPanel, gbc, labelFont);
        addIncludeRow(formPanel, gbc, labelFont);
        addExcludeRow(formPanel, gbc, labelFont);
        addTraceLevelRow(formPanel, gbc, labelFont);

        // Bottom spacer: absorbs all remaining vertical space so rows don't spread out
        gbc.gridx = 0; gbc.gridy = 11; gbc.gridwidth = 2;
        gbc.weightx = 0.0; gbc.weighty = 1.0;
        gbc.fill = GridBagConstraints.BOTH;
        formPanel.add(new JPanel() {{ setOpaque(false); }}, gbc);

        return formPanel;
    }

    // ── Form row helpers ────────────────────────────────────────────────────────

    private void addIdTypeRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 0: ID Type
        gbc.gridx = 0; gbc.gridy = 0; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel idTypeLabel = new JLabel("ID Type:");
        idTypeLabel.setFont(labelFont);
        idTypeLabel.setMinimumSize(new Dimension(120, 25));
        idTypeLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(idTypeLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        idTypeComboBox = new JComboBox<>(new String[]{"Installation ID", "Serial Number"});
        styleComboBox(idTypeComboBox);
        idTypeComboBox.addActionListener(e -> updateIdType());
        formPanel.add(idTypeComboBox, gbc);
    }

    private void addEnterIdRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 1: Enter ID
        gbc.gridx = 0; gbc.gridy = 1; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel idLabel = new JLabel("Enter ID:");
        idLabel.setFont(labelFont);
        idLabel.setMinimumSize(new Dimension(120, 25));
        idLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(idLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        idField = new AutoCompleteTextField("", 20, new ArrayList<>());
        // Disable autocomplete; user wants direct editing without stored values interfering
        idField.disableAutoComplete();
        idField.addFocusListener(new FocusAdapter() {
            private boolean firstFocus = true;
            @Override
            public void focusGained(FocusEvent e) {
                if (firstFocus) {
                    SwingUtilities.invokeLater(idField::selectAll);
                    firstFocus = false;
                }
            }
        });
        styleTextField(idField);
        idField.setPreferredSize(new Dimension(300, 32));
        idField.setMinimumSize(new Dimension(250, 32));
        formPanel.add(idField, gbc);
    }

    private void addDateRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 2: Date
        gbc.gridx = 0; gbc.gridy = 2; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel dateLabel = new JLabel("Date:");
        dateLabel.setFont(labelFont);
        dateLabel.setMinimumSize(new Dimension(120, 25));
        dateLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(dateLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        dateField = new JTextField(DATE_FORMAT.format(new Date()), 14);
        dateField.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        styleTextField(dateField);
        JButton nowButton = new JButton("Now");
        nowButton.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        nowButton.setMargin(new Insets(2, 8, 2, 8));
        nowButton.setPreferredSize(new Dimension(55, dateField.getPreferredSize().height));
        nowButton.setMinimumSize(new Dimension(55, 24));
        nowButton.addActionListener(e -> dateField.setText(DATE_FORMAT.format(new Date())));
        JPanel datePanel = new JPanel(new BorderLayout(5, 0));
        datePanel.setBackground(Color.WHITE);
        datePanel.add(dateField, BorderLayout.CENTER);
        datePanel.add(nowButton, BorderLayout.EAST);
        formPanel.add(datePanel, gbc);
    }

    private void addTimeWindowRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 3: Time Window
        gbc.gridx = 0; gbc.gridy = 3; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel directionLabel = new JLabel("Time Window:");
        directionLabel.setFont(labelFont);
        directionLabel.setMinimumSize(new Dimension(120, 25));
        directionLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(directionLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        timeDirectionComboBox = new JComboBox<>(new String[]{"Find Previous", "Find Next", "Find Previous/Next"});
        styleComboBox(timeDirectionComboBox);
        timeDirectionComboBox.addActionListener(e -> {
            configuration.setSearchDirection((String) timeDirectionComboBox.getSelectedItem());
            saveUserSettings();
        });
        formPanel.add(timeDirectionComboBox, gbc);
    }

    private void addTimeRangeRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 4: Time Range
        gbc.gridx = 0; gbc.gridy = 4; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel timeRangeLabel = new JLabel("Time Range:");
        timeRangeLabel.setFont(labelFont);
        timeRangeLabel.setMinimumSize(new Dimension(120, 25));
        timeRangeLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(timeRangeLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        JPanel timeRangePanel = new JPanel(new GridBagLayout());
        timeRangePanel.setBackground(Color.WHITE);
        GridBagConstraints timeGbc = new GridBagConstraints();
        timeGbc.gridx = 0; timeGbc.gridy = 0; timeGbc.weightx = 0.3; timeGbc.fill = GridBagConstraints.HORIZONTAL;
        timeGbc.insets = new Insets(0, 0, 0, 5);
        timeRangeField = new JTextField("30", 8);
        styleTextField(timeRangeField);
        timeRangePanel.add(timeRangeField, timeGbc);
        timeGbc.gridx = 1; timeGbc.weightx = 0.7; timeGbc.fill = GridBagConstraints.HORIZONTAL;
        timeGbc.insets = new Insets(0, 0, 0, 0);
        timeUnitComboBox = new JComboBox<>(new String[]{"minutes", "hours", "days", "weeks"});
        timeUnitComboBox.setSelectedItem("minutes");
        styleComboBox(timeUnitComboBox);
        timeRangePanel.add(timeUnitComboBox, timeGbc);
        formPanel.add(timeRangePanel, gbc);
    }

    private void addLogsPathRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 5: Logs Path
        gbc.gridx = 0; gbc.gridy = 5; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel logsLabel = new JLabel("Logs Path:");
        logsLabel.setFont(labelFont);
        logsLabel.setMinimumSize(new Dimension(120, 25));
        logsLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(logsLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        JPanel logsPanel = new JPanel(new GridBagLayout());
        logsPanel.setBackground(Color.WHITE);
        GridBagConstraints logsGbc = new GridBagConstraints();
        logsGbc.gridx = 0; logsGbc.gridy = 0; logsGbc.weightx = 1.0; logsGbc.fill = GridBagConstraints.HORIZONTAL;
        logsField = new AutoCompleteTextField(configuration.getLogs(), 20, new ArrayList<>());
        styleTextField(logsField);
        logsPanel.add(logsField, logsGbc);
        logsGbc.gridx = 1; logsGbc.weightx = 0; logsGbc.fill = GridBagConstraints.NONE;
        logsGbc.insets = new Insets(0, 5, 0, 0);
        JButton browseLogsButton = new JButton("Select...");
        browseLogsButton.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        browseLogsButton.addActionListener(e -> selectLogsDirectory());
        logsPanel.add(browseLogsButton, logsGbc);
        formPanel.add(logsPanel, gbc);
    }

    private void addCountryRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 6: Country
        gbc.gridx = 0; gbc.gridy = 6; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel countryLabel = new JLabel("Country:");
        countryLabel.setFont(labelFont);
        countryLabel.setMinimumSize(new Dimension(120, 25));
        countryLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(countryLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        // GB is the correct ISO code for United Kingdom
        countriesComboBox = new JComboBox<>(new String[]{"ES", "PT", "IT", "FR", "DE", "GB", "AR", "CL", "MX", "BR"});
        styleComboBox(countriesComboBox);
        countriesComboBox.addActionListener(e -> updateCountry());
        formPanel.add(countriesComboBox, gbc);
    }

    private void addConfigRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 7: Config
        gbc.gridx = 0; gbc.gridy = 7; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel configLabel = new JLabel("Config:");
        configLabel.setFont(labelFont);
        configLabel.setMinimumSize(new Dimension(120, 25));
        configLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(configLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        configComboBox = new JComboBox<>(new String[]{"All", "Photos", "Calls", "Communications", "Doorlock", "FOTA", "Custom"});
        styleComboBox(configComboBox);
        configComboBox.addActionListener(e -> updateConfig());
        formPanel.add(configComboBox, gbc);
    }

    private void addIncludeRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 8: Include
        gbc.gridx = 0; gbc.gridy = 8; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        includeLabel = new JLabel("Include:");
        includeLabel.setFont(labelFont);
        includeLabel.setMinimumSize(new Dimension(120, 25));
        includeLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(includeLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        includeField = createHintTextField("e.g. photo, \"svk init\"");
        styleTextField(includeField);
        includeField.setToolTipText("<html>Comma-separated keywords or phrases (case-insensitive).<br>Only logs containing <b>at least one</b> match are written.<br><b>Single word:</b> photo, camera<br><b>Exact phrase:</b> \"photo error\", \"svk init\"<br><b>Mix:</b> camera, \"svk init\"</html>");
        attachKeywordLabel(includeField, includeLabel, "Include");
        formPanel.add(includeField, gbc);
    }

    private void addExcludeRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 9: Exclude
        gbc.gridx = 0; gbc.gridy = 9; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        excludeLabel = new JLabel("Exclude:");
        excludeLabel.setFont(labelFont);
        excludeLabel.setMinimumSize(new Dimension(120, 25));
        excludeLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(excludeLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        excludeField = createHintTextField("e.g. timeout, \"connection refused\"");
        styleTextField(excludeField);
        excludeField.setToolTipText("<html>Comma-separated keywords or phrases (case-insensitive).<br>Logs containing <b>any</b> match are removed from output.<br><b>Single word:</b> error, timeout<br><b>Exact phrase:</b> \"connection refused\", \"null pointer\"<br><b>Mix:</b> timeout, \"connection refused\"</html>");
        attachKeywordLabel(excludeField, excludeLabel, "Exclude");
        formPanel.add(excludeField, gbc);
    }

    private JPanel createButtonPanel() {
        JPanel buttonPanel = new JPanel(new GridLayout(3, 2, 10, 10));
        buttonPanel.setBackground(Color.WHITE);
        buttonPanel.setBorder(BorderFactory.createEmptyBorder(20, 0, 0, 0));

        // Botón principal
        downloadButton = createStyledButton("Download", new Color(0, 123, 255), Color.WHITE);
        downloadButton.addActionListener(e -> downloadLogs());
        buttonPanel.add(downloadButton);

        JButton openLogButton = createStyledButton("Open Log", new Color(138, 43, 226), Color.WHITE);
        openLogButton.addActionListener(e -> openLog());
        buttonPanel.add(openLogButton);

        JButton exportButton = createStyledButton("Export ZIP", new Color(40, 167, 69), Color.WHITE);
        exportButton.addActionListener(e -> exportZip());
        buttonPanel.add(exportButton);

        JButton clearButton = createStyledButton("Clear", new Color(255, 193, 7), new Color(33, 37, 41));
        clearButton.addActionListener(e -> clearOutput());
        buttonPanel.add(clearButton);


        // Botón para CSV Parser GUI (naranja fuerte)
        csvParserButton = createStyledButton("CSV Parser GUI", new Color(255, 87, 34), Color.WHITE); // Deep Orange
        csvParserButton.addActionListener(e -> runExternalPythonScript(
            new String[]{"UltraKibanaDownloader/csvParserGUI.py"}, "CSV Parser GUI"));
        buttonPanel.add(csvParserButton);

        // Botón para Config Download (verde fuerte)
        configDownloadButton = createStyledButton("Config Download", new Color(46, 204, 113), Color.BLACK); // Strong Green
        configDownloadButton.addActionListener(e -> {
            String idValue = idField.getText().trim();
            String country = (String) countriesComboBox.getSelectedItem();
            if (idValue.isEmpty()) {
                appendOut("Error: Enter ID field is required for Config Download.\n");
                updateError("ID required for Config Download");
                return;
            }
            // Pass both ID and country as arguments (separated)
            runExternalPythonScript(
                new String[]{"UltraKibanaDownloader/analizar_json.py", idValue, country},
                "Config Download"
            );
        });
        buttonPanel.add(configDownloadButton);

        return buttonPanel;
    }

    private void addTraceLevelRow(JPanel formPanel, GridBagConstraints gbc, Font labelFont) {
        // Row 10: Trace Level
        gbc.gridx = 0; gbc.gridy = 10; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel traceLevelLabel = new JLabel("Trace Level:");
        traceLevelLabel.setFont(labelFont);
        traceLevelLabel.setMinimumSize(new Dimension(120, 25));
        traceLevelLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(traceLevelLabel, gbc);

        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        traceLevelComboBox = new JComboBox<>(new String[]{"All [D+I+W+E]", "Debug [D]", "Info [I]", "Warn [W]", "Error [E]", "Info+Warn+Error"});
        styleComboBox(traceLevelComboBox);
        traceLevelComboBox.addActionListener(e -> updateTraceLevels());
        formPanel.add(traceLevelComboBox, gbc);
    }

    private void updateTraceLevels() {
        String selected = (String) traceLevelComboBox.getSelectedItem();
        enabledTraceLevels.clear();
        if (selected == null || selected.startsWith("All")) {
            enabledTraceLevels.addAll(Arrays.asList("D", "I", "W", "E"));
        } else if (selected.startsWith("Debug")) {
            enabledTraceLevels.add("D");
        } else if (selected.startsWith("Info+")) {
            enabledTraceLevels.addAll(Arrays.asList("I", "W", "E"));
        } else if (selected.startsWith("Info")) {
            enabledTraceLevels.add("I");
        } else if (selected.startsWith("Warn")) {
            enabledTraceLevels.add("W");
        } else if (selected.startsWith("Error")) {
            enabledTraceLevels.add("E");
        }
    }

    private File resolveProjectRoot() {
        List<File> candidates = new ArrayList<>();

        try {
            File codeSource = new File(UltraKibanaDownloader.class
                    .getProtectionDomain()
                    .getCodeSource()
                    .getLocation()
                    .toURI());
            if (codeSource.isFile()) {
                File jarDir = codeSource.getParentFile();
                if (jarDir != null) {
                    candidates.add(jarDir);
                    File parent = jarDir.getParentFile();
                    if (parent != null) {
                        candidates.add(parent);
                        File grandParent = parent.getParentFile();
                        if (grandParent != null) {
                            candidates.add(grandParent);
                        }
                    }
                }
            } else {
                candidates.add(codeSource);
                File parent = codeSource.getParentFile();
                if (parent != null) {
                    candidates.add(parent);
                }
            }
        } catch (URISyntaxException | SecurityException ignored) {
            // Fallback handled later.
        }

        File currentDir = new File(System.getProperty("user.dir"));
        candidates.add(currentDir);
        File parentDir = currentDir.getParentFile();
        if (parentDir != null) {
            candidates.add(parentDir);
        }

        for (File candidate : candidates) {
            File resolved = resolveCandidateToProjectRoot(candidate);
            if (resolved != null) {
                return resolved;
            }
        }

        return currentDir;
    }

    private File resolveCandidateToProjectRoot(File candidate) {
        if (candidate == null) {
            return null;
        }

        // If the candidate itself looks like the Python package directory, return its parent
        if (isPythonPackageDir(candidate)) {
            File parent = candidate.getParentFile();
            return parent != null ? parent : candidate;
        }

        // Otherwise, check for a nested package directory
        File pkgDir = new File(candidate, "UltraKibanaDownloader");
        if (isPythonPackageDir(pkgDir)) {
            return candidate;
        }

        return null;
    }

    private boolean isPythonPackageDir(File dir) {
        if (dir == null || !dir.isDirectory()) {
            return false;
        }
        File initFile = new File(dir, "__init__.py");
        File mainFile = new File(dir, "main.py");
        return initFile.isFile() && mainFile.isFile();
    }

    // Ejecuta un script Python externo y muestra la salida en el outputArea
    private void runExternalPythonScript(String[] scriptAndArgs, String scriptName) {
        executorService.submit(() -> {
            try {
                String pythonPath = findPythonPath();
                if (pythonPath == null) {
                    SwingUtilities.invokeLater(() -> {
                        appendOut("Error: Python no encontrado para " + scriptName + "\n");
                        updateError("Python no encontrado");
                    });
                    return;
                }
                // Convertir el primer argumento (script) a path absoluto si es relativo
                String scriptPath = scriptAndArgs[0];
                File scriptFile = new File(scriptPath);
                if (!scriptFile.isAbsolute()) {
                    scriptFile = new File(projectRoot, scriptPath);
                }
                // Fallback: if the provided relative path (e.g. UltraKibanaDownloader/analizar_json.py) does not exist,
                // try to locate the script by its file name in the project root directory.
                if (!scriptFile.exists()) {
                    File fallback = new File(projectRoot, new File(scriptPath).getName());
                    if (fallback.exists()) {
                        scriptFile = fallback; // use fallback location
                    } else {
                        final String msg = "Error: No se encontró el script Python: " + scriptFile.getAbsolutePath() +
                                " (también se buscó en: " + fallback.getAbsolutePath() + ")\n";
                        SwingUtilities.invokeLater(() -> {
                            appendOut(msg);
                            updateError("Script Python no encontrado");
                        });
                        return;
                    }
                }
                // Construir la lista de argumentos con el path absoluto
                List<String> commandList = new ArrayList<>();
                commandList.add(pythonPath);
                commandList.add(scriptFile.getAbsolutePath());
                for (int i = 1; i < scriptAndArgs.length; i++) {
                    commandList.add(scriptAndArgs[i]);
                }
                ProcessBuilder pb = new ProcessBuilder(commandList);
                pb.directory(projectRoot);
                String pythonPathEnv = projectRoot.getAbsolutePath();
                String existingPyPath = pb.environment().get("PYTHONPATH");
                if (existingPyPath != null && !existingPyPath.trim().isEmpty()) {
                    pythonPathEnv = pythonPathEnv + File.pathSeparator + existingPyPath;
                }
                pb.environment().put("PYTHONPATH", pythonPathEnv);
                pb.redirectErrorStream(true);
                // clear any previous cancel flag and delete any leftover signal file
                cancelRequested = false;
                try { new File(CANCEL_SIGNAL_PATH).delete(); } catch (Exception ignore) {}
                Process process = pb.start();
                // Keep reference so user can cancel the external Python process
                currentProcess = process;
                BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                String line;
                SwingUtilities.invokeLater(() -> {
                    appendOut("\n=== Ejecutando " + scriptName + " ===\n");
                });
                while ((line = reader.readLine()) != null) {
                    // If cancellation was requested, keep draining Python's stdout so its
                    // output buffer never fills up and it can reach the signal-file check.
                    // Do NOT break or kill here — Python will exit by itself once it detects
                    // the ukd_cancel.signal file at the start of the next scroll iteration.
                    if (cancelRequested) {
                        // Drain but don't display further output
                        continue;
                    }
                    final String outputLine = line;
                    SwingUtilities.invokeLater(() -> {
                        appendOut(outputLine + "\n");
                    });
                }
                int exitCode = process.waitFor();
                // Clear reference when process finishes
                currentProcess = null;
                // Remove signal file so next download starts clean
                try { new File(CANCEL_SIGNAL_PATH).delete(); } catch (Exception ignore) {}
                // If cancellation was requested, report it
                if (cancelRequested) {
                    final int code = exitCode;
                    SwingUtilities.invokeLater(() -> {
                        appendOut("\n=== DOWNLOAD CANCELLED ===\n");
                        updateStatus("Cancelled by user");
                        showProgress(false);
                        enableAllButtons();
                        cancelRequested = false;
                    });
                }
                SwingUtilities.invokeLater(() -> {
                    if (exitCode == 0) {
                        appendOut("\u2713  " + scriptName + " completed\n\n");
                    } else {
                        appendOut("\u2717  " + scriptName + " failed (code: " + exitCode + ")\n\n");
                    }
                    enableAllButtons();
                });
            } catch (Exception e) {
                SwingUtilities.invokeLater(() -> {
                    appendOut("\u2717  " + scriptName + " error: " + e.getMessage() + "\n\n");
                    updateError("Error running " + scriptName);
                    enableAllButtons();
                });
            }
        });
    }

    private JButton createStyledButton(String text, Color backgroundColor, Color textColor) {
        JButton button = new JButton(text);
        button.setFont(new Font("Segoe UI", Font.BOLD, 12));
        button.setBackground(backgroundColor);
        button.setForeground(textColor);
        button.setBorder(BorderFactory.createEmptyBorder(12, 20, 12, 20));
        button.setFocusPainted(false);
        button.setCursor(new Cursor(Cursor.HAND_CURSOR));
        
        // Hover effect
        button.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseEntered(MouseEvent e) {
                button.setBackground(backgroundColor.brighter());
            }
            
            @Override
            public void mouseExited(MouseEvent e) {
                button.setBackground(backgroundColor);
            }
        });
        
        return button;
    }

    private JPanel createOutputPanel() {
        JPanel outputPanel = new JPanel(new BorderLayout());
        outputPanel.setBackground(Color.WHITE);
        outputPanel.setBorder(BorderFactory.createEmptyBorder(20, 10, 20, 20));

        // Title
        JLabel outputTitle = new JLabel("Output Console");
        outputTitle.setFont(new Font("Segoe UI", Font.BOLD, 16));
        outputTitle.setForeground(new Color(33, 37, 41));
        outputTitle.setBorder(BorderFactory.createEmptyBorder(0, 0, 15, 0));
        outputPanel.add(outputTitle, BorderLayout.NORTH);

        // Output area with dark console theme (JTextPane for coloured output)
        outputArea = new JTextPane();
        outputArea.setFont(new Font("Consolas", Font.PLAIN, 12));
        outputArea.setBackground(new Color(40, 44, 52));
        outputArea.setForeground(new Color(171, 178, 191));
        outputArea.setMargin(new Insets(15, 15, 15, 15));
        outputArea.setEditable(false);
        printWelcome();

        JScrollPane scrollPane = new JScrollPane(outputArea);
        scrollPane.setBorder(BorderFactory.createLineBorder(new Color(220, 220, 220), 1));
        scrollPane.getVerticalScrollBar().setUnitIncrement(16);
        scrollPane.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);
        scrollPane.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_AS_NEEDED);
        
        outputPanel.add(scrollPane, BorderLayout.CENTER);

        return outputPanel;
    }

    private JPanel createStatusPanel() {
        JPanel statusPanel = new JPanel(new BorderLayout());
        statusPanel.setBackground(new Color(250, 250, 250));
        statusPanel.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createMatteBorder(1, 0, 0, 0, new Color(230, 230, 230)),
            BorderFactory.createEmptyBorder(8, 15, 8, 15)
        ));

        // Status label
        statusLabel = new JLabel("Ready");
        statusLabel.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        statusLabel.setForeground(new Color(108, 117, 125));
        statusPanel.add(statusLabel, BorderLayout.WEST);

        // Progress bar + Stop button container
        progressBar = new JProgressBar();
        progressBar.setVisible(false);
        progressBar.setStringPainted(true);
        progressBar.setMinimum(0);
        progressBar.setMaximum(100);

        JPanel centerPanel = new JPanel(new BorderLayout(8, 0));
        centerPanel.setOpaque(false);
        centerPanel.add(progressBar, BorderLayout.CENTER);

        stopButton = new JButton("Stop");
        // Keep Stop visible so users can always see where it is; enable only during a running task
        stopButton.setVisible(true);
        stopButton.setEnabled(false);
        stopButton.setPreferredSize(new Dimension(80, 26));
        stopButton.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        stopButton.addActionListener(ev -> {
            // Signal cancellation and try terminating the external process
            cancelRequested = true;
            // Create signal file: Python polls this on every scroll iteration
            try { new File(CANCEL_SIGNAL_PATH).createNewFile(); } catch (Exception ignore) {}
            if (currentProcess != null) {
                try {
                    killProcessTree(currentProcess);
                } catch (Exception ex) {
                    try {
                        currentProcess.destroy();
                        Thread.sleep(200);
                        if (currentProcess.isAlive()) currentProcess.destroyForcibly();
                    } catch (Exception ignore) {
                    }
                }
            }
            updateStatus("Cancellation requested...");
            appendOut("\n=== USER REQUESTED CANCEL ===\n");
            stopButton.setEnabled(false);
        });

        centerPanel.add(stopButton, BorderLayout.EAST);
        statusPanel.add(centerPanel, BorderLayout.CENTER);

        // Right side panel: Stop button already added inside centerPanel, but place copyright and
        // ensure a fixed area on the right so Stop is not clipped on small windows.
        JPanel rightPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        rightPanel.setOpaque(false);
        // Add copyright label to the right area
        JLabel copyright = new JLabel("© 2026 Verisure - Ultra KibanaDownloader");
        copyright.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        copyright.setForeground(new Color(134, 142, 150));
        rightPanel.add(stopButton);
        rightPanel.add(Box.createHorizontalStrut(6));
        rightPanel.add(copyright);
        statusPanel.add(rightPanel, BorderLayout.EAST);

        return statusPanel;
    }

    private void styleTextField(JTextField field) {
        field.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        field.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(220, 220, 220), 1),
            BorderFactory.createEmptyBorder(8, 12, 8, 12)
        ));
        field.setBackground(Color.WHITE);
        field.setForeground(new Color(33, 37, 41));
        // Make caret & selection clearly visible
        field.setCaretColor(new Color(0, 123, 255));
        field.setSelectionColor(new Color(0, 123, 255, 60));
        field.setSelectedTextColor(new Color(33,37,41));
        // Use a thicker caret for better visibility when typing
        if (field.getCaret() == null || !(field.getCaret() instanceof ThickCaret)) {
            ThickCaret caret = new ThickCaret();
            caret.setBlinkRate(500);
            field.setCaret(caret);
        }
        // Store original background for focus/blur transitions
        Color originalBg = field.getBackground();
        
        // Add focus effect
        field.addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(FocusEvent e) {
                field.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(new Color(0, 123, 255), 2),
                    BorderFactory.createEmptyBorder(7, 11, 7, 11)
                ));
                // Light tint to show active field
                field.setBackground(new Color(235, 245, 255));
            }
            
            @Override
            public void focusLost(FocusEvent e) {
                field.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(new Color(220, 220, 220), 1),
                    BorderFactory.createEmptyBorder(8, 12, 8, 12)
                ));
                field.setBackground(originalBg);
            }
        });
    }

    private void styleComboBox(JComboBox<String> comboBox) {
        comboBox.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        comboBox.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(220, 220, 220), 1),
            BorderFactory.createEmptyBorder(4, 8, 4, 8)
        ));
        comboBox.setBackground(Color.WHITE);
        comboBox.setForeground(new Color(33, 37, 41));
        
        // Remove default combo box styling
        comboBox.setOpaque(true);
        comboBox.putClientProperty("JComboBox.isTableCellEditor", Boolean.TRUE);
        
        // Try to flatten ComboBox appearance
        try {
            comboBox.setUI(new javax.swing.plaf.basic.BasicComboBoxUI() {
                @Override
                protected JButton createArrowButton() {
                    JButton button = new JButton();
                    button.setBorder(BorderFactory.createEmptyBorder());
                    button.setBackground(Color.WHITE);
                    button.setText("▼");
                    button.setFont(new Font("Segoe UI", Font.PLAIN, 10));
                    button.setForeground(new Color(100, 100, 100));
                    return button;
                }
            });
        } catch (Exception e) {
            // Fallback if custom UI fails
        }
        
        // Add focus effect
        comboBox.addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(FocusEvent e) {
                comboBox.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(new Color(0, 123, 255), 2),
                    BorderFactory.createEmptyBorder(3, 7, 3, 7)
                ));
            }
            
            @Override
            public void focusLost(FocusEvent e) {
                comboBox.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(new Color(220, 220, 220), 1),
                    BorderFactory.createEmptyBorder(4, 8, 4, 8)
                ));
            }
        });
    }

    private void updateStatus(String message) {
        SwingUtilities.invokeLater(() -> {
            statusLabel.setText(message);
            statusLabel.setForeground(new Color(40, 167, 69));
        });
    }

    private void updateError(String message) {
        SwingUtilities.invokeLater(() -> {
            statusLabel.setText("Error: " + message);
            statusLabel.setForeground(new Color(220, 53, 69));
        });
    }

    private void showProgress(boolean show) {
        SwingUtilities.invokeLater(() -> {
            progressBar.setVisible(show);
            progressBar.setIndeterminate(show);
            // Show/hide and enable/disable stop button together with progress
            if (stopButton != null) {
                stopButton.setVisible(show);
                stopButton.setEnabled(show);
            }
        });
    }

    private void downloadLogs() {
        // Local atomics for thread-safe progress tracking and CFG block detection
        // (AtomicBoolean/AtomicInteger allow capture inside the executor lambda)
        final AtomicInteger maxLogsToRetrieve = new AtomicInteger(0);
        final AtomicBoolean inConfigBlock = new AtomicBoolean(false);
        
        updateConfiguration();
        
        // Validate required fields
        if (idField.getText().trim().isEmpty()) {
            appendOut("\nError: ID field is required!\n\n");
            updateError("ID field is required");
            return;
        }
        
        if (getDateFieldText().trim().isEmpty()) {
            appendOut("\nError: Date field is required!\n\n");
            updateError("Date field is required");
            return;
        }
        
        if (timeRangeField.getText().trim().isEmpty()) {
            appendOut("\nError: Time range field is required!\n\n");
            updateError("Time range field is required");
            return;
        }
        
        try {
            Integer.parseInt(timeRangeField.getText().trim());
        } catch (NumberFormatException e) {
            appendOut("\nError: Time range must be a valid number!\n\n");
            updateError("Time range must be a valid number");
            return;
        }

        // All validations passed: now disable button to avoid concurrent executions
        if (downloadButton != null) downloadButton.setEnabled(false);
        
        String _cfgStr = configuration.getSelectedConfig();
        if (!configuration.getCustom().trim().isEmpty()) _cfgStr += " (" + configuration.getCustom() + ")";
        appendStyled("\n", C_DEFAULT, false);
        appendStyled("  ▶  LOG DOWNLOAD STARTED\n", C_WARN, true);
        appendStyled("  ─────────────────────────────────────────\n", C_DIM, false);
        appendSmart(String.format("  %-12s: %s%n", "Date",        configuration.getDate()));
        appendSmart(String.format("  %-12s: %s%n", "Time Range",   describeTimeRange()));
        appendSmart(String.format("  %-12s: %s%n", "ID",           idField.getText() + " (" + configuration.getIdType() + ")"));
        appendSmart(String.format("  %-12s: %s%n", "Config",       _cfgStr));
        appendSmart(String.format("  %-12s: %s%n", "Environment",  "OnCloud / " + configuration.getCountry()));
        if (!configuration.getIncludeKeywords().trim().isEmpty())
            appendSmart(String.format("  %-12s: %s%n", "Include",  configuration.getIncludeKeywords()));
        if (!configuration.getExcludeKeywords().trim().isEmpty())
            appendSmart(String.format("  %-12s: %s%n", "Exclude",  configuration.getExcludeKeywords()));
        appendStyled("  ─────────────────────────────────────────\n\n", C_DIM, false);
        
        updateStatus("Downloading logs...");
        showProgress(true);
        
        executorService.submit(() -> {
            try {
                // Buscar cualquier subcarpeta que contenga main.py y __init__.py
                File[] subdirs = projectRoot.listFiles(File::isDirectory);
                File pythonPackageDir = null;
                if (subdirs != null) {
                    for (File dir : subdirs) {
                        if (isPythonPackageDir(dir)) {
                            pythonPackageDir = dir;
                            break;
                        }
                    }
                }
                // Si no hay subcarpeta válida, comprobar si los scripts están directamente en projectRoot
                if (pythonPackageDir == null && isPythonPackageDir(projectRoot)) {
                    pythonPackageDir = projectRoot;
                }
                if (pythonPackageDir == null) {
                    SwingUtilities.invokeLater(() -> {
                        appendOut("Error: No valid Python package (with main.py and __init__.py) found in\n" + projectRoot.getAbsolutePath() + "\n" +
                                "Please run the application from the extracted folder (keep the .jar together with the Python scripts).\n\n");
                        updateError("Python package missing");
                        showProgress(false);
                        if (downloadButton != null) downloadButton.setEnabled(true);
                    });
                    return;
                }

                // Find Python executable
                String pythonPath = findPythonPath();
                if (pythonPath == null) {
                    SwingUtilities.invokeLater(() -> {
                        appendOut("Error: Python executable not found.\n\n");
                        updateError("Python executable not found");
                        showProgress(false);
                    });
                    return;
                }
                
                // Build command using ProcessBuilder for better argument handling.
                // Prefer module execution to ensure package-relative imports work.
                List<String> commandList = new ArrayList<>();
                commandList.add(pythonPath);
                commandList.add("-m");
                commandList.add("UltraKibanaDownloader.main");
                
                // Add config file
                String configFile;
                try {
                    if (!configuration.getCustom().trim().isEmpty()) {
                        configFile = createCustomConfigFile(configuration.getSelectedConfig(), configuration.getCustom());
                    } else {
                        configFile = getConfigFile(configuration.getSelectedConfig());
                    }
                } catch (IOException e) {
                    configFile = getConfigFile(configuration.getSelectedConfig());
                }
                commandList.add(configFile);
                
                // If using conf_all, pass the preset name so Python selects the right sub-config
                if (!"Services".equals(configFile)) {
                    commandList.add("--configName");
                    commandList.add(configuration.getSelectedConfig());
                }
                
                // Add verbose flag
                commandList.add("-v");
                
                // Add logs path
                commandList.add("-p");
                File logsDir = new File(configuration.getLogs());
                if (!logsDir.exists()) {
                    if (!logsDir.mkdirs()) {
                        final String msg = "Warning: Could not create logs directory at " + logsDir.getAbsolutePath();
                        SwingUtilities.invokeLater(() -> {
                            appendOut(msg + "\n");
                            updateError("Failed to create logs directory");
                        });
                    }
                }
                commandList.add(logsDir.getAbsolutePath());
                
                // Add date
                commandList.add("-d");
                commandList.add(configuration.getDate());
                
                // Add ID parameter based on type
                String idType = configuration.getIdType();
                String idValue = idField.getText().trim();
                
                if ("Installation ID".equals(idType)) {
                    commandList.add("-i");
                    commandList.add(idValue);
                } else if ("Serial Number".equals(idType)) {
                    commandList.add("-u");
                    commandList.add(idValue);
                }
                
                // Kibana environment fixed to OnCloud
                commandList.add("-n");
                commandList.add("aws");
                
                // Add country
                commandList.add("-c");
                commandList.add(configuration.getCountry());
                
                // Add start/end minutes (time window control)
                // New semantics: configuration.getTraces() is TOTAL window length for split mode (Find Previous/Next)
                int startMinutes = 10;
                int endMinutes = 0;
                try {
                    int total = Integer.parseInt(configuration.getTraces());
                    String direction = configuration.getSearchDirection();
                    if (direction == null) direction = "Find Previous";
                    switch (direction) {
                        case "Find Next":
                            startMinutes = 0;
                            endMinutes = Math.max(total, 0);
                            break;
                        case "Find Previous/Next":
                            // Split total window approximately in half
                            int half = Math.max(total, 0) / 2;
                            int remainder = Math.max(total, 0) - half; // ensures total = half + remainder
                            startMinutes = half;        // minutes backwards
                            endMinutes = remainder;     // minutes forward (equal or +1)
                            break;
                        case "Find Previous":
                        default:
                            startMinutes = Math.max(total, 0);
                            endMinutes = 0;
                            break;
                    }
                } catch (NumberFormatException ignored) {
                    // Keep defaults
                }

                commandList.add("-s");
                commandList.add(String.valueOf(startMinutes));
                commandList.add("-e");
                commandList.add(String.valueOf(endMinutes));
                
                // Add include keywords
                if (!configuration.getIncludeKeywords().trim().isEmpty()) {
                    commandList.add("--include");
                    commandList.add(configuration.getIncludeKeywords());
                }
                
                // Add exclude keywords
                if (!configuration.getExcludeKeywords().trim().isEmpty()) {
                    commandList.add("--exclude");
                    commandList.add(configuration.getExcludeKeywords());
                }
                
                // Execute the Python script
                ProcessBuilder pb = new ProcessBuilder(commandList);
                pb.directory(projectRoot);
                String pythonPathEnv = projectRoot.getAbsolutePath();
                String existingPyPath = pb.environment().get("PYTHONPATH");
                if (existingPyPath != null && !existingPyPath.trim().isEmpty()) {
                    pythonPathEnv = pythonPathEnv + File.pathSeparator + existingPyPath;
                }
                pb.environment().put("PYTHONPATH", pythonPathEnv);
                pb.redirectErrorStream(true);
                
                Process process = pb.start();
                
                // Read the output
                BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                String line;
                
                while ((line = reader.readLine()) != null) {
                    final String outputLine = line;
                    SwingUtilities.invokeLater(() -> {
                        // Check if this is a progress message
                        if (outputLine.startsWith("PROGRESS:")) {
                            // Extract the progress message content
                            String progressMessage = outputLine.substring(9).trim(); // Remove "PROGRESS: "
                            
                            appendOut("  " + progressMessage + "\n");
                            
                            // Also update the status bar and progress bar for key progress events
                            if (progressMessage.contains("Initializing Elasticsearch")) {
                                updateStatus("Initializing query...");
                                progressBar.setIndeterminate(true);
                            } else if (progressMessage.contains("Preparing to fetch")) {
                                updateStatus("Preparing large download...");
                                progressBar.setIndeterminate(true);
                            } else if (progressMessage.contains("Total logs found")) {
                                updateStatus("Found logs, retrieving...");
                                progressBar.setIndeterminate(false);
                                progressBar.setValue(0);
                            } else if (progressMessage.contains("Found") && progressMessage.contains("logs")) {
                                // Handle "Found X logs" message
                                try {
                                    String[] parts = progressMessage.split(" ");
                                    for (int i = 0; i < parts.length - 1; i++) {
                                        if ("Found".equals(parts[i]) && "logs".equals(parts[i + 2])) {
                                            String count = parts[i + 1];
                                            int logCount = Integer.parseInt(count);
                                            if (logCount == 0) {
                                                updateStatus("No logs found - check search criteria");
                                                progressBar.setValue(0);
                                                progressBar.setString("No logs found");
                                            } else {
                                                updateStatus("Found " + count + " logs, retrieving...");
                                                progressBar.setValue(0);
                                                progressBar.setString("Found " + count + " logs");
                                            }
                                            break;
                                        }
                                    }
                                } catch (Exception e) {
                                    updateStatus("Searching for logs...");
                                }
                            } else if (progressMessage.contains("Retrieved") && progressMessage.contains("logs") && progressMessage.contains("%")) {
                                // Extract percentage from "Retrieved X/Y logs (Z%)"
                                try {
                                    int percentStart = progressMessage.indexOf("(");
                                    int percentEnd = progressMessage.indexOf("%");
                                    if (percentStart != -1 && percentEnd != -1) {
                                        String percentStr = progressMessage.substring(percentStart + 1, percentEnd);
                                        float percent = Float.parseFloat(percentStr);
                                        if (percent > 100) percent = 100;
                                        progressBar.setValue((int) percent);
                                        // Extract count for status
                                        String[] parts = progressMessage.split(" ");
                                        for (int i = 0; i < parts.length - 1; i++) {
                                            if ("Retrieved".equals(parts[i]) && parts[i + 1].contains("/")) {
                                                String countPart = parts[i + 1];
                                                String[] split = countPart.split("/");
                                                String currentCount = split[0];
                                                String maxCount = split.length > 1 ? split[1] : "";
                                                // Si el currentCount supera el maxCount, mostrar maxCount
                                                int curr = Integer.parseInt(currentCount);
                                                int max = maxCount.isEmpty() ? 0 : Integer.parseInt(maxCount);
                                                if (max > 0 && curr > max) curr = max;
                                                updateStatus("Retrieved " + curr + "/" + max + " logs (" + (int) percent + "%)");
                                                break;
                                            }
                                        }
                                    }
                                } catch (Exception e) {
                                    updateStatus("Retrieving logs...");
                                }
                            } else if (progressMessage.contains("Retrieved") && progressMessage.contains("logs so far")) {
                                // Extract the number from "Retrieved X logs so far..."
                                try {
                                    String[] parts = progressMessage.split(" ");
                                    for (int i = 0; i < parts.length - 1; i++) {
                                        if ("Retrieved".equals(parts[i]) && "logs".equals(parts[i + 2])) {
                                            String count = parts[i + 1];
                                            updateStatus("Retrieved " + count + " logs...");
                                            break;
                                        }
                                    }
                                } catch (Exception e) {
                                    updateStatus("Retrieving logs...");
                                }
                            } else if (progressMessage.contains("Completed!") || progressMessage.contains("Final result")) {
                                updateStatus("Processing completed...");
                                progressBar.setValue(100);
                            } else if (progressMessage.contains("Searching for logs")) {
                                updateStatus("Searching for logs...");
                                progressBar.setIndeterminate(true);
                            } else if (progressMessage.contains("Will retrieve up to")) {
                                // Extract the limit and set progress bar to determinate
                                progressBar.setIndeterminate(false);
                                progressBar.setValue(0);
                            }
                        } else if (outputLine.trim().equals("==================================================")) {
                            // Visual separator line - display with emphasis
                            appendOut("-".repeat(50) + "\n");
                        } else if (outputLine.startsWith("DEBUG") && outputLine.contains("Retrieved") && outputLine.contains("logs so far")) {
                            // Handle DEBUG messages with progress information
                            try {
                                String[] parts = outputLine.split(" ");
                                for (int i = 0; i < parts.length - 1; i++) {
                                    if ("Retrieved".equals(parts[i]) && "logs".equals(parts[i + 2])) {
                                        String count = parts[i + 1];
                                        int currentCount = Integer.parseInt(count);
                                        
                                        // Calculate progress if we know the total
                                        if (maxLogsToRetrieve.get() > 0) {
                                            float percentage = (currentCount / (float) maxLogsToRetrieve.get()) * 100f;
                                            int p = Math.min(100, Math.max(0, Math.round(percentage)));
                                            progressBar.setValue(p);
                                            updateStatus("Retrieved " + count + " logs (" + String.format("%.1f", Math.min(100f, percentage)) + "%)");
                                        } else {
                                            updateStatus("Retrieved " + count + " logs...");
                                        }
                                        
                                        appendOut("  Retrieved " + count + " logs so far...\n");
                                        break;
                                    }
                                }
                            } catch (Exception e) {
                                appendOut(outputLine + "\n");
                            }
                        } else if (outputLine.startsWith("DEBUG") && outputLine.contains("Using scroll API")) {
                            // Handle scroll API debug message and extract max count
                            try {
                                // Look for pattern "Using scroll API for large result set of XXXXX"
                                if (outputLine.contains("result set of")) {
                                    String[] parts = outputLine.split("result set of ");
                                    if (parts.length > 1) {
                                        String maxCount = parts[1].trim();
                                        maxLogsToRetrieve.set(Integer.parseInt(maxCount));
                                        appendOut("  Using scroll API - will retrieve up to " + maxCount + " logs\n");
                                        updateStatus("Preparing to retrieve up to " + maxCount + " logs...");
                                        
                                        // Set progress bar to determinate mode
                                        progressBar.setIndeterminate(false);
                                        progressBar.setValue(0);
                                    }
                                } else {
                                    appendOut("  Using scroll API for large result set\n");
                                    updateStatus("Using scroll API for large download...");
                                }
                            } catch (Exception e) {
                                appendOut("  Using scroll API for large result set\n");
                                updateStatus("Using scroll API for large download...");
                            }
                        } else if (outputLine.startsWith("DEBUG") && outputLine.contains("Total logs found")) {
                            // Handle total logs found debug message
                            try {
                                String[] parts = outputLine.split(" ");
                                for (int i = 0; i < parts.length - 1; i++) {
                                    if ("found:".equals(parts[i])) {
                                        String totalCount = parts[i + 1];
                                        appendOut("  Total logs found: " + totalCount + "\n");
                                        updateStatus("Found " + totalCount + " logs total");
                                        break;
                                    }
                                }
                            } catch (Exception e) {
                                appendOut(outputLine + "\n");
                            }
                        } else if (outputLine.startsWith("CFG ")) {
                            // Raw configuration block handling (verbatim display without summary)
                            String cfgContent = outputLine.substring(4).trim();
                            if (cfgContent.startsWith("CONFIGURACION DE LA INSTALACION")) {
                                inConfigBlock.set(true);
                                appendSmart(cfgContent + "\n");
                            } else if (cfgContent.startsWith("FIN CONFIGURACION")) {
                                appendSmart(cfgContent + "\n\n");
                                inConfigBlock.set(false);
                            } else if (inConfigBlock.get()) {
                                appendSmart(cfgContent + "\n");
                            } else {
                                appendSmart(cfgContent + "\n");
                            }
                        } else if (outputLine.startsWith("DEBUG") && outputLine.contains("CFG ")) {
                            // Config block line via Python logger: strip "DEBUG    CFG " prefix and display clean
                            int _ci = outputLine.indexOf("CFG ");
                            String _cc = (_ci >= 0) ? outputLine.substring(_ci + 4) : outputLine;
                            if (!_cc.trim().isEmpty()) appendOut(_cc + "\n");
                        } else if (outputLine.startsWith("DEBUG")) {
                            // Other Python logger lines (device/frames/internals): hide from user output
                        } else if (outputLine.trim().isEmpty()) {
                            // Skip empty lines
                        } else {
                            // Regular output line – smart colouring
                            appendSmart(outputLine + "\n");
                        }
                    });
                }
                
                int exitCode = process.waitFor();
                
                SwingUtilities.invokeLater(() -> {
                    if (exitCode == 0) {
                        appendStyled("\n  ✓  DOWNLOAD COMPLETED\n", C_SUCCESS, true);
                        appendStyled("  ─────────────────────────────────────────\n", C_DIM, false);
                        appendStyled("  Files : ", C_LABEL, false);
                        appendStyled(configuration.getLogs() + "\n", C_VALUE, false);
                        
                        // Show generated files
                        showGeneratedFiles();
                        
                        // Check if any logs were actually found
                        if (outputArea.getText().contains("Retrieved 0/0 logs") || outputArea.getText().contains("Final result: 0 logs retrieved")) {
                            appendOut("\n[WARNING] No logs found for the specified criteria.\n");
                            appendOut("Try expanding the time range or adjusting the search parameters.\n\n");
                            updateStatus("No logs found - check search criteria");
                        } else {
                            updateStatus("Download completed");
                        }

                        // Intentar leer config.log y añadir secciones extendidas si existen
                        // Post-download hook placeholder (removed unused variable)
                        try {
                            java.nio.file.Paths.get(configuration.getLogs());
                        } catch (Exception ex) {
                            appendOut("[WARN] Post-download hook error: " + ex.getMessage() + "\n");
                        }
                    } else {
                        appendStyled("\n  ✗  DOWNLOAD FAILED  (exit code: " + exitCode + ")\n", C_ERROR, true);
                        appendStyled("  ─────────────────────────────────────────\n\n", C_DIM, false);
                        updateError("Download failed");
                    }
                    showProgress(false);
                    enableAllButtons();
                });
                
            } catch (Exception e) {
                // Ensure we clear any process reference if an exception occurs
                currentProcess = null;
                cancelRequested = false;
                SwingUtilities.invokeLater(() -> {
                    appendOut("Error: " + e.getMessage() + "\n\n");
                    updateError(e.getMessage());
                    showProgress(false);
                    enableAllButtons();
                });
            }
        });
    }

    private void shutdownExecutor() {
        executorService.shutdownNow();
    }

    /** Re-enables all primary action buttons after any task completes or is cancelled. */
    private void enableAllButtons() {
        if (downloadButton != null) downloadButton.setEnabled(true);
        if (csvParserButton != null) csvParserButton.setEnabled(true);
        if (configDownloadButton != null) configDownloadButton.setEnabled(true);
    }

    private String getConfigFile(String configName) {
        if ("Custom".equals(configName)) return "Services";  // dynamically generated file
        return "conf_all";  // all other presets live in conf_all.py
    }

    // Detect Windows platform
    private boolean isWindows() {
        String os = System.getProperty("os.name");
        return os != null && os.toLowerCase().contains("win");
    }

    // Kill a process and its children. On Windows use taskkill /T /F, otherwise try destroyForcibly.
    private void killProcessTree(Process p) {
        if (p == null) return;
        try {
            long pid = p.pid();
            if (isWindows()) {
                // taskkill with /T kills the process tree
                List<String> cmd = new ArrayList<>();
                cmd.add("cmd"); cmd.add("/c");
                cmd.add("taskkill"); cmd.add("/PID"); cmd.add(Long.toString(pid)); cmd.add("/T"); cmd.add("/F");
                new ProcessBuilder(cmd).inheritIO().start().waitFor();
            } else {
                p.destroy();
                try { Thread.sleep(200); } catch (InterruptedException ignored) {}
                if (p.isAlive()) p.destroyForcibly();
            }
        } catch (Exception e) {
            try {
                if (p.isAlive()) p.destroyForcibly();
            } catch (Exception ignore) {}
        }
    }
    
    private void showGeneratedFiles() {
        String logsPath = configuration.getLogs();
        File logsDir = new File(logsPath);
        if (logsDir.exists()) {
            File[] logFiles = logsDir.listFiles((dir, name) -> 
                name.toLowerCase().endsWith(".log") || name.toLowerCase().endsWith(".txt"));
            if (logFiles != null && logFiles.length > 0) {
                appendOut("Generated files:\n");
                for (File file : logFiles) {
                    appendStyled("  - " + file.getName() + " (" + file.length() + " bytes)\n", C_INFO, false);
                }
            }
        }
    }

    private void openLog() {
        try {
            String logsPath = configuration.getLogs();
            File logsDir = new File(logsPath);
            
            if (!logsDir.exists()) {
                appendOut("\nError: Logs directory does not exist: " + logsPath + "\n\n");
                updateError("Logs directory not found");
                return;
            }
            
            File mostRecentFile = findMostRecentLogFile(logsDir, "ordered.log");
            
            if (mostRecentFile == null) {
                appendOut("\nNo log files found in: " + logsPath + "\n");
                appendOut("Please run Download first to generate log files.\n\n");
                updateError("No log files found");
                return;
            }
            
            if (Desktop.isDesktopSupported()) {
                Desktop desktop = Desktop.getDesktop();
                desktop.open(mostRecentFile);
                appendOut("\nOpening log file: " + mostRecentFile.getName() + "\n");
                appendStyled("File path: " + mostRecentFile.getAbsolutePath() + "\n", C_INFO, false);
                appendStyled("File opened in default editor.\n\n", C_DEFAULT, false);
                updateStatus("Log file opened: " + mostRecentFile.getName());
            } else {
                appendOut("\nDesktop not supported. Cannot open file automatically.\n");
                appendStyled("Please manually open: " + mostRecentFile.getAbsolutePath() + "\n\n", C_DEFAULT, false);
                updateError("Desktop not supported");
            }
            
        } catch (Exception e) {
            appendOut("\nError opening log file: " + e.getMessage() + "\n\n");
            updateError("Failed to open log file: " + e.getMessage());
        }
        
    }

    private File findMostRecentLogFile(File directory, String fileName) {
        File mostRecentFile = null;
        long mostRecentModifiedTime = Long.MIN_VALUE;

        File[] files = directory.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isDirectory()) {
                    File candidate = findMostRecentLogFile(file, fileName);
                    if (candidate != null && candidate.lastModified() > mostRecentModifiedTime) {
                        mostRecentFile = candidate;
                        mostRecentModifiedTime = candidate.lastModified();
                    }
                } else if (file.getName().equals(fileName) && file.lastModified() > mostRecentModifiedTime) {
                    mostRecentFile = file;
                    mostRecentModifiedTime = file.lastModified();
                }
            }
        }

        return mostRecentFile;
    }

    private void exportZip() {
        try {
            String logsPath = configuration.getLogs();
            File logsDir = new File(logsPath);
            
            if (!logsDir.exists()) {
                appendOut("\nError: Logs directory does not exist: " + logsPath + "\n\n");
                updateError("Logs directory not found");
                return;
            }
            
            // Find the most recent log directory
            File mostRecentDir = findMostRecentLogDirectory(logsDir);
            
            if (mostRecentDir == null) {
                appendOut("\nNo log directories found in: " + logsPath + "\n");
                appendOut("Please run Download first to generate log files.\n\n");
                updateError("No log directories found");
                return;
            }
            
            // Get all log files from the most recent directory
            File[] logFiles = mostRecentDir.listFiles((dir, name) -> 
                name.toLowerCase().endsWith(".log") || name.toLowerCase().endsWith(".txt"));
            
            if (logFiles == null || logFiles.length == 0) {
                appendOut("\nNo log files found in: " + mostRecentDir.getAbsolutePath() + "\n");
                appendOut("Please run Download first to generate log files.\n\n");
                updateError("No log files found");
                return;
            }
            
            // Create ZIP file name based on the directory name
            String zipName = mostRecentDir.getName() + "_logs.zip";
            File zipFile = new File(zipName);
            
            appendOut("\nExporting logs to ZIP...\n");
            appendStyled("Source directory: " + mostRecentDir.getName() + "\n", C_INFO, false);
            appendStyled("ZIP file: " + zipName + "\n", C_INFO, false);
            appendStyled("Including " + logFiles.length + " log files:\n", C_INFO, false);
            
            // Create the ZIP file
            try (FileOutputStream fos = new FileOutputStream(zipFile);
                 ZipOutputStream zos = new ZipOutputStream(fos)) {
                
                for (File file : logFiles) {
                    appendStyled("  - " + file.getName() + " (" + file.length() + " bytes)\n", C_INFO, false);
                    
                    // Add file to ZIP
                    try (FileInputStream fis = new FileInputStream(file)) {
                        ZipEntry zipEntry = new ZipEntry(file.getName());
                        zos.putNextEntry(zipEntry);
                        
                        byte[] buffer = new byte[1024];
                        int length;
                        while ((length = fis.read(buffer)) > 0) {
                            zos.write(buffer, 0, length);
                        }
                        zos.closeEntry();
                    }
                }
                
                appendOut("\nZIP file created successfully: " + zipFile.getAbsolutePath() + "\n\n");
                updateStatus("ZIP export completed: " + zipName);
            }
            
        } catch (Exception e) {
            appendOut("\nError creating ZIP file: " + e.getMessage() + "\n\n");
            updateError("Failed to create ZIP file: " + e.getMessage());
        }
        
    }

    private File findMostRecentLogDirectory(File logsDir) {
        File mostRecentDir = null;
        long mostRecentModifiedTime = Long.MIN_VALUE;
        
        File[] directories = logsDir.listFiles(File::isDirectory);
        if (directories != null) {
            for (File dir : directories) {
                if (dir.lastModified() > mostRecentModifiedTime) {
                    mostRecentDir = dir;
                    mostRecentModifiedTime = dir.lastModified();
                }
            }
        }
        
        return mostRecentDir;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Coloured output helpers  (JTextPane / StyledDocument)
    // ──────────────────────────────────────────────────────────────────────

    // Palette tuned for the dark background (40, 44, 52)
    private static final Color C_DEFAULT = new Color(171, 178, 191); // light gray  – normal text
    private static final Color C_DIM     = new Color(92,  99,  112); // dim gray    – separators
    private static final Color C_SUCCESS = new Color(152, 195, 121); // green       – success / completed
    private static final Color C_ERROR   = new Color(224, 108, 117); // red         – errors / failures
    private static final Color C_WARN    = new Color(229, 192, 123); // amber       – warnings / headers
    private static final Color C_INFO    = new Color(97,  175, 239); // cyan/blue   – progress info
    private static final Color C_VALUE   = new Color(220, 223, 228); // near-white  – values in key:value
    private static final Color C_LABEL   = new Color(106, 153, 185); // muted blue  – labels in key:value
    private static final Color C_DEVICE  = new Color(198, 120, 221); // violet      – device type names
    private static final Color C_SECTION = new Color(86,  182, 194); // teal        – section titles

    /** Insert {@code text} into the output pane with the given colour and boldness. */
    private void appendStyled(String text, Color fg, boolean bold) {
        StyledDocument doc = outputArea.getStyledDocument();
        Style style = outputArea.addStyle("_tmp", null);
        StyleConstants.setForeground(style, fg);
        StyleConstants.setBold(style, bold);
        try {
            doc.insertString(doc.getLength(), text, style);
        } catch (BadLocationException ignored) {}
        outputArea.setCaretPosition(doc.getLength());
    }

    /**
     * Append a line to the console, automatically choosing a colour:
     *  ----/====          → dim gray   (separators)
     *  ✗ / Error: / FAILED/CANCELLED → red bold  (errors)
     *  ✓ / COMPLETED / Completed!    → green bold (success)
     *  WARNING / Warning  → amber bold (warnings)
     *  === / LOG / DOWNLOAD (headers) → amber bold
     *  Found/Retrieved/Total/Initializing/… → cyan  (live progress)
     *  everything else    → light gray (default)
     */
    private void appendOut(String text) {
        // Respect trace-level filter: if the line contains a trace level tag like [D]/[I]/[W]/[E]
        // and that level is currently disabled, skip printing the line.
        Matcher traceMatcher = TRACE_LEVEL_PATTERN.matcher(text);
        if (traceMatcher.find()) {
            String lvl = traceMatcher.group(1);
            if (enabledTraceLevels != null && !enabledTraceLevels.contains(lvl)) {
                return; // filtered out
            }
        }

        String t = text.trim();
        Color fg;
        boolean bold;
        if (t.startsWith("----") || t.startsWith("====")) {
            fg = C_DIM;     bold = false;
        } else if (t.startsWith("\u2717") || t.startsWith("Error:")
                || t.contains("FAILED") || t.contains("CANCELLED")
                || t.startsWith("[WARN]")) {
            fg = C_ERROR;   bold = true;
        } else if (t.startsWith("\u2713") || t.contains("COMPLETED")
                || t.contains("Completed!")) {
            fg = C_SUCCESS; bold = true;
        } else if (t.contains("WARNING") || t.contains("Warning")
                || t.contains("[WARNING]")) {
            fg = C_WARN;    bold = true;
        } else if (t.startsWith("===") || t.startsWith("\u25b6")
                || t.startsWith("LOG ") || t.startsWith("DOWNLOAD ")) {
            fg = C_WARN;    bold = true;
        } else if (t.startsWith("Found ") || t.startsWith("Retrieved ")
                || t.startsWith("Total ") || t.startsWith("Initializing ")
                || t.startsWith("Connecting ") || t.startsWith("Files: ")
                || t.startsWith("Using scroll")) {
            fg = C_INFO;    bold = false;
        } else {
            fg = C_DEFAULT; bold = false;
        }
        appendStyled(text, fg, bold);
    }

    /** Print the welcome banner with colours. Called on init and after clear. */
    private void printWelcome() {
        appendStyled("\n", C_DEFAULT, false);
        appendStyled("  Ultra Kibana Traces Downloader\n", C_SECTION, true);
        appendStyled("  ──────────────────────────────\n\n", C_DIM, false);
        appendStyled("  Ready to download logs.\n", C_DEFAULT, false);
        appendStyled("  Configure parameters and click 'Download'.\n\n", C_DIM, false);
    }

    /**
     * Smart colorizer for lines that come from external scripts (analizar_json.py, etc.).
     * Handles: separators, section titles, sub-headers, key:value splits,
     * device count lines, bullet items with device names, and generic text.
     */
    private void appendSmart(String text) {
        String t = text.trim();
        if (t.isEmpty()) { appendStyled("\n", C_DEFAULT, false); return; }
        String nl = text.endsWith("\n") ? "\n" : "";

        // ── Separators ─────────────────────────────────────────────────
        if (t.startsWith("====") || t.startsWith("----")) {
            appendStyled(text, C_DIM, false);
            return;
        }

        // ── Section titles: all-caps words  e.g. "RESUMEN DE LA INSTALACION"
        if (t.matches("[A-Z][A-ZÁÉÍÓÚ ]{4,}")) {
            // Measure indentation
            int ind = 0;
            while (ind < text.length() && text.charAt(ind) == ' ') ind++;
            appendStyled(text.substring(0, ind) + t + nl, C_SECTION, true);
            return;
        }

        // ── Success confirmation ────────────────────────────────────────
        if (t.contains("correctamente") || t.startsWith("✓")) {
            appendStyled(text, C_SUCCESS, false);
            return;
        }

        // ── Errors ─────────────────────────────────────────────────────
        if (t.startsWith("Error") || t.startsWith("✗") || t.contains("FAILED")) {
            appendStyled(text, C_ERROR, true);
            return;
        }

        // ── Sub-headers: short lines ending with ":" e.g. "Nodos:", "CU:"
        if (t.endsWith(":") && t.length() <= 35 && !t.contains("|")) {
            int ind = 0;
            while (ind < text.length() && text.charAt(ind) == ' ') ind++;
            appendStyled(text.substring(0, ind), C_DEFAULT, false);
            appendStyled(t + nl, C_WARN, true);
            return;
        }

        // ── "Intentando abrir..." informational ────────────────────────
        if (t.startsWith("Intentando") || t.startsWith("Searching") || t.startsWith("Connecting")) {
            appendStyled(text, C_INFO, false);
            return;
        }

        // ── Bullet lines containing "•" ────────────────────────────────
        int bulletIdx = text.indexOf("•");
        if (bulletIdx >= 0) {
            String indent  = text.substring(0, bulletIdx);
            String content = text.substring(bulletIdx + 1).trim();
            // Try to color the leading device type (word before first ":")
            int colon = content.indexOf(":");
            if (colon > 0 && colon <= 15 && content.substring(0, colon).trim().matches("[A-Z0-9]+")) {
                String typePart = content.substring(0, colon).trim();
                String rest     = content.substring(colon + 1).trim();
                appendStyled(indent + "• ", C_WARN, false);
                appendStyled(typePart, C_DEVICE, true);
                appendStyled(": " + rest + nl, C_DEFAULT, false);
            } else {
                appendStyled(indent + "• ", C_WARN, false);
                appendStyled(content + nl, C_INFO, false);
            }
            return;
        }

        // ── Device count lines:  "   - TYPENAME      : N" ──────────────
        if (t.startsWith("-")) {
            String inner = t.substring(1).trim();
            int sep = inner.indexOf(" : ");
            if (sep > 0) {
                String devName = inner.substring(0, sep).trim();
                String count   = inner.substring(sep + 3).trim();
                int dashPos    = text.indexOf('-');
                String spaces  = text.substring(0, dashPos);
                appendStyled(spaces + "  ─ ", C_DIM, false);
                appendStyled(devName, C_DEVICE, true);
                appendStyled(" : ", C_DIM, false);
                appendStyled(count + nl, C_VALUE, true);
                return;
            }
        }

        // ── Key : Value lines  e.g. "Serial Number         : 26MQ5LEG" ─
        int sep = t.indexOf(" : ");
        if (sep > 0) {
            int ind = 0;
            while (ind < text.length() && text.charAt(ind) == ' ') ind++;
            String label = t.substring(0, sep).trim();
            String value = t.substring(sep + 3).trim();
            appendStyled(text.substring(0, ind), C_DEFAULT, false);
            appendStyled(label, C_LABEL, false);
            appendStyled(" : ", C_DIM, false);
            appendStyled(value + nl, C_VALUE, false);
            return;
        }

        // ── Default ────────────────────────────────────────────────────
        appendOut(text);
    }

    private void clearOutput() {
        outputArea.setText("");
        printWelcome();
        updateStatus("Output cleared");
    }

    private void updateConfiguration() {
        configuration.setDate(getDateFieldText());
    String resolvedLogs = resolveLogsPath(logsField.getText());
    configuration.setLogs(resolvedLogs);
    logsField.setText(resolvedLogs);
        configuration.setTraces(String.valueOf(getTimeRangeInMinutes()));
    configuration.setKibanaType("OnCloud");
        configuration.setCountry((String) countriesComboBox.getSelectedItem());
        configuration.setSelectedConfig((String) configComboBox.getSelectedItem());
        configuration.setIdType((String) idTypeComboBox.getSelectedItem());
        configuration.setIncludeKeywords(includeField.getText());
        configuration.setExcludeKeywords(excludeField.getText());
        if (timeDirectionComboBox != null) {
            configuration.setSearchDirection((String) timeDirectionComboBox.getSelectedItem());
        }
        saveUserSettings();
    }
    
    private int getTimeRangeInMinutes() {
        try {
            int value = Integer.parseInt(timeRangeField.getText().trim());
            String unit = (String) timeUnitComboBox.getSelectedItem();
            
            switch (unit) {
                case "minutes": return value;
                case "hours": return value * 60;
                case "days": return value * 24 * 60;
                case "weeks": return value * 7 * 24 * 60;
                default: return 10; // Default fallback
            }
        } catch (NumberFormatException e) {
            return 10; // Default fallback
        }
    }

    private String describeTimeRange() {
        String rawValue = timeRangeField.getText().trim();
        String unit = String.valueOf(timeUnitComboBox.getSelectedItem());
    String direction = String.valueOf(configuration.getSearchDirection());

        if (rawValue.isEmpty()) {
            rawValue = "0";
        }
        if (direction == null || direction.trim().isEmpty()) {
            direction = "Backwards";
        }

        String normalizedUnit = unit;
        if ("1".equals(rawValue) && unit.endsWith("s")) {
            normalizedUnit = unit.substring(0, unit.length() - 1);
        }

        switch (direction) {
            case "Find Next":
                return rawValue + " " + normalizedUnit + " forward from base time";
            case "Find Previous/Next":
                return rawValue + " " + normalizedUnit + " total (split previous/next)";
            case "Find Previous":
            default:
                return rawValue + " " + normalizedUnit + " backward from base time";
        }
    }

    private void loadConfiguration() {
        // Normalizamos país si viene de una config previa con código antiguo
        if ("UK".equalsIgnoreCase(configuration.getCountry())) {
            configuration.setCountry("GB");
        }
        if (timeDirectionComboBox != null) {
            String dir = configuration.getSearchDirection();
            if (dir == null || dir.trim().isEmpty()) {
                dir = "Find Previous"; // default
            }
            // Migrate old stored values to new labels
            if ("Past".equals(dir)) dir = "Find Previous";
            else if ("Future".equals(dir)) dir = "Find Next";
            else if ("Past+Future".equals(dir)) dir = "Find Previous/Next";
            timeDirectionComboBox.setSelectedItem(dir);
            configuration.setSearchDirection(dir);
        }
        updateStatus("Using default configuration");
    }

    private String resolveLogsPath(String inputPath) {
        String candidate = (inputPath == null || inputPath.trim().isEmpty()) ? "logs" : inputPath.trim();
        File path = new File(candidate);
        if (!path.isAbsolute()) {
            path = new File(getAppDir(), candidate);
        }
        return path.getAbsolutePath();
    }

    private void selectLogsDirectory() {
        JFileChooser chooser = new JFileChooser(new File(configuration.getLogs()));
        chooser.setDialogTitle("Select Logs Folder");
        chooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
        chooser.setAcceptAllFileFilterUsed(false);

        int result = chooser.showOpenDialog(frame);
        if (result == JFileChooser.APPROVE_OPTION) {
            File selected = chooser.getSelectedFile();
            String resolved = resolveLogsPath(selected.getAbsolutePath());
            logsField.setText(resolved);
            configuration.setLogs(resolved);
            saveUserSettings();
            if (outputArea != null) {
                SwingUtilities.invokeLater(() -> {
                    appendOut("Logs directory set to: " + resolved + "\n");
                    updateStatus("Logs directory updated");
                });
            }
        }
    }

    private void loadUserSettings() {
        File settingsFile = getUserSettingsFile();
        if (!settingsFile.exists()) {
            return;
        }

        Properties props = new Properties();
        try (FileInputStream fis = new FileInputStream(settingsFile)) {
            props.load(fis);
            String logsPath = props.getProperty("logsPath");
            if (logsPath != null && !logsPath.trim().isEmpty()) {
                configuration.setLogs(logsPath.trim());
            }
            String direction = props.getProperty("searchDirection");
            if (direction != null && !direction.trim().isEmpty()) {
                configuration.setSearchDirection(direction.trim());
            }
        } catch (IOException ignored) {
            // If loading fails, fall back to defaults silently
        }
    }

    private void saveUserSettings() {
        File settingsFile = getUserSettingsFile();
        Properties props = new Properties();
        props.setProperty("logsPath", configuration.getLogs());
        props.setProperty("searchDirection", configuration.getSearchDirection());

        try (FileOutputStream fos = new FileOutputStream(settingsFile)) {
            props.store(fos, "UltraKibanaDownloader user settings");
        } catch (IOException e) {
            if (outputArea != null) {
                SwingUtilities.invokeLater(() -> appendOut("[WARN] Could not persist user settings: " + e.getMessage() + "\n"));
            }
        }
    }

    private File getUserSettingsFile() {
        return new File(getAppDir(), USER_SETTINGS_FILE_NAME);
    }

    /**
     * Returns the directory where app data (logs, user-settings) should be stored.
     * When running from a JAR, this is the UltraKibanaDownloader/ folder next to the JAR.
     * Otherwise falls back to projectRoot.
     */
    private File getAppDir() {
        File ukDir = new File(projectRoot, "UltraKibanaDownloader");
        return ukDir.isDirectory() ? ukDir : projectRoot;
    }

    // updateKibanaType removed (fixed env)

    private void updateCountry() {
        String selected = (String) countriesComboBox.getSelectedItem();
        configuration.setCountry(normalizeCountry(selected));
    }

    // Mapea códigos antiguos a los correctos (e.g. UK -> GB)
    private String normalizeCountry(String code) {
        if (code == null) return null;
        switch (code.toUpperCase()) {
            case "UK": return "GB"; // Código ISO 3166-1 alpha-2 correcto
            default: return code;
        }
    }

    private void updateConfig() {
        String selectedConfig = (String) configComboBox.getSelectedItem();
        configuration.setSelectedConfig(selectedConfig);
        // Si el usuario selecciona 'Custom', prellenar el campo de servicios personalizados con 'cuxs-voip-uad' si está vacío
        if ("Custom".equals(selectedConfig)) {
            if (configuration.getCustom() == null || configuration.getCustom().trim().isEmpty()) {
                configuration.setCustom("cuxs-voip-uad");
            }
            openServiceSelectionDialog();
        } else {
            // Clear custom services when a standard config is selected
            configuration.setCustom("");
        }
    }

    private void updateIdType() {
        configuration.setIdType((String) idTypeComboBox.getSelectedItem());
    }

    private String createCustomConfigFile(String baseConfigName, String customServices) throws IOException {
        // Build Services.py from the selected preset in conf_all.py, overriding its services list.
        // We generate the file directly — no need to read conf_all.py (Python parses CONFIGS at runtime).
        // The generated file follows the simple flat-module format that main.py expects.

        // Custom services: comma-separated string → quoted list
        StringBuilder svcList = new StringBuilder();
        for (String svc : customServices.split(",")) {
            String s = svc.trim();
            if (!s.isEmpty()) {
                if (svcList.length() > 0) svcList.append(",\n");
                svcList.append("    \"").append(s).append("\"");
            }
        }

        // Write a comment so the user knows which preset was the base
        String customConfigFile = "Services.py";
        try (PrintWriter writer = new PrintWriter(new FileWriter(customConfigFile))) {
            writer.println("# Auto-generated by UltraKibanaDownloader — base preset: " + baseConfigName);
            writer.println("# Edit conf_all.py to change the preset definitions.");
            writer.println("import sys, importlib, types as _types");
            writer.println("_base = importlib.import_module('conf_all').CONFIGS.get('" + baseConfigName + "', {})");
            writer.println("services   = [\n" + svcList + "\n]");
            writer.println("tags       = _base.get('tags', [])");
            writer.println("listTagged = _base.get('listTagged', [])");
            writer.println("listFiltered = _base.get('listFiltered', [])");
        }
        return "Services";  // module name without .py
    }

    private String findPythonPath() {
        String os = System.getProperty("os.name").toLowerCase();
        boolean isWin = os.contains("win");

        // 1. Prefer a venv bundled next to the project root (created by the installer)
        String[] venvRelPaths = isWin
            ? new String[]{".venv\\Scripts\\python.exe", "venv\\Scripts\\python.exe",
                           "packaging\\.venv_pack\\Scripts\\python.exe"}
            : new String[]{".venv/bin/python3", "venv/bin/python3", ".venv/bin/python", "venv/bin/python"};
        for (String rel : venvRelPaths) {
            File candidate = new File(projectRoot, rel);
            if (candidate.exists()) {
                return candidate.getAbsolutePath();
            }
        }

        // 2. Ask the OS for python, but skip Windows Store stubs (WindowsApps)
        try {
            ProcessBuilder processBuilder;
            if (isWin) {
                processBuilder = new ProcessBuilder("cmd.exe", "/c", "where python");
            } else {
                processBuilder = new ProcessBuilder("which", "python3");
            }
            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty()) continue;
                    // Skip Windows Store App Execution Alias stubs — they have no packages
                    if (isWin && line.toLowerCase().contains("windowsapps")) continue;
                    process.waitFor();
                    return line;
                }
                process.waitFor();
            }
            if (!isWin) {
                // Fallback: try plain 'python'
                processBuilder = new ProcessBuilder("which", "python");
                processBuilder.redirectErrorStream(true);
                process = processBuilder.start();
                try (BufferedReader reader2 = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line = reader2.readLine();
                    process.waitFor();
                    if (line != null && !line.trim().isEmpty()) {
                        return line.trim();
                    }
                }
            }
        } catch (IOException | InterruptedException e) {
            appendOut("Error finding Python: " + e.getMessage() + "\n");
        }

        return isWin ? "python" : "python3";
    }

    private void openServiceSelectionDialog() {
        String[] allServices = {
            "cuxscored", "cuxsdialerd", "cuxs-situationd", "cuxs-rengined", "cuxsinstallerd",
            "cuxsupdaterd", "cuxszapatofonod", "gsmsrv", "cuxs-ired", "ofonod",
            "cuxspaparazzod", "cuxs-wired", "cuxs-wised", "cuxs-auditord", "cuxs-fenixd",
            "cuxs-powerd", "cuxs-timed", "xundertakerd", "cuxs-cm4-manager", "cuxscoprocessorloggerd",
            "cuxs-dect-setup", "cuxs-msp-manager", "x-notariod", "hostapd@uap0",
            "cuxs-voip-uad",
            // Added per latest user list (missing previously)
            "tasman-transport-broker", "tasman-impl-rpmsgd", "tasman-impl-uartd",
            "powerd", "ired", "xbitacorad", "xconfigrepod", "devicehubd",
            "phoenixd", "mq-bridged"
        };

        // Create modern dialog
        JDialog dialog = new JDialog(frame, "Service Selection", true);
        dialog.setSize(600, 500);
        dialog.setLocationRelativeTo(frame);
        dialog.setLayout(new BorderLayout());
        
        // Modern header panel
        JPanel headerPanel = new JPanel(new BorderLayout());
        headerPanel.setBackground(new Color(0, 123, 255));
        headerPanel.setBorder(BorderFactory.createEmptyBorder(20, 25, 20, 25));
        
        JLabel titleLabel = new JLabel("Custom Service Configuration");
        titleLabel.setFont(new Font("Segoe UI", Font.BOLD, 18));
        titleLabel.setForeground(Color.WHITE);
        headerPanel.add(titleLabel, BorderLayout.WEST);
        
        JLabel subtitleLabel = new JLabel("Select services to include in logs");
        subtitleLabel.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        subtitleLabel.setForeground(new Color(220, 235, 255));
        headerPanel.add(subtitleLabel, BorderLayout.SOUTH);
        
        dialog.add(headerPanel, BorderLayout.NORTH);
        
        // Main content panel
        JPanel contentPanel = new JPanel(new BorderLayout());
        contentPanel.setBackground(Color.WHITE);
        contentPanel.setBorder(BorderFactory.createEmptyBorder(20, 25, 20, 25));
        
    // Search + manual add panel
    JPanel searchPanel = new JPanel();
    searchPanel.setLayout(new BoxLayout(searchPanel, BoxLayout.Y_AXIS));
    searchPanel.setBackground(Color.WHITE);
    searchPanel.setBorder(BorderFactory.createEmptyBorder(0, 0, 15, 0));

    JPanel searchRow = new JPanel(new FlowLayout(FlowLayout.LEFT));
    searchRow.setBackground(Color.WHITE);
        
    JLabel searchLabel = new JLabel("Filter services:");
        searchLabel.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        searchLabel.setForeground(new Color(108, 117, 125));
    searchRow.add(searchLabel);
        
        JTextField searchField = new JTextField(20);
        styleTextField(searchField);
    searchRow.add(searchField);
        
        JButton selectAllButton = createStyledButton("Select All", new Color(40, 167, 69), Color.WHITE);
        selectAllButton.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        selectAllButton.setBorder(BorderFactory.createEmptyBorder(6, 12, 6, 12));
    searchRow.add(selectAllButton);
        
        JButton deselectAllButton = createStyledButton("Deselect All", new Color(108, 117, 125), Color.WHITE);
        deselectAllButton.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        deselectAllButton.setBorder(BorderFactory.createEmptyBorder(6, 12, 6, 12));
    searchRow.add(deselectAllButton);

    searchPanel.add(searchRow);

    // Manual add row
    JPanel manualRow = new JPanel(new FlowLayout(FlowLayout.LEFT));
    manualRow.setBackground(Color.WHITE);
    JLabel manualLabel = new JLabel("Add service:");
    manualLabel.setFont(new Font("Segoe UI", Font.PLAIN, 12));
    manualLabel.setForeground(new Color(108,117,125));
    manualRow.add(manualLabel);
    JTextField manualField = new JTextField(18);
    styleTextField(manualField);
    manualRow.add(manualField);
    JButton addServiceButton = createStyledButton("Add", new Color(0,123,255), Color.WHITE);
    addServiceButton.setFont(new Font("Segoe UI", Font.PLAIN, 11));
    addServiceButton.setBorder(BorderFactory.createEmptyBorder(6, 14, 6, 14));
    manualRow.add(addServiceButton);
    searchPanel.add(manualRow);
        
        contentPanel.add(searchPanel, BorderLayout.NORTH);
        
        // Services list with modern checkboxes
        JPanel servicesPanel = new JPanel();
        servicesPanel.setLayout(new BoxLayout(servicesPanel, BoxLayout.Y_AXIS));
        servicesPanel.setBackground(Color.WHITE);
        
        List<JCheckBox> serviceCheckboxes = new ArrayList<>();
        
        for (String service : allServices) {
            JCheckBox checkbox = new JCheckBox(service);
            checkbox.setFont(new Font("Segoe UI", Font.PLAIN, 13));
            checkbox.setBackground(Color.WHITE);
            checkbox.setForeground(new Color(33, 37, 41));
            checkbox.setBorder(BorderFactory.createEmptyBorder(8, 10, 8, 10));
            checkbox.setFocusPainted(false);
            
            // Modern checkbox styling
            checkbox.setIcon(createCheckboxIcon(false));
            checkbox.setSelectedIcon(createCheckboxIcon(true));
            checkbox.setRolloverIcon(createCheckboxIcon(false, true));
            checkbox.setRolloverSelectedIcon(createCheckboxIcon(true, true));
            
            // Add hover effect
            checkbox.addMouseListener(new MouseAdapter() {
                @Override
                public void mouseEntered(MouseEvent e) {
                    checkbox.setBackground(new Color(248, 249, 250));
                }
                
                @Override
                public void mouseExited(MouseEvent e) {
                    checkbox.setBackground(Color.WHITE);
                }
            });
            
            serviceCheckboxes.add(checkbox);
            servicesPanel.add(checkbox);
        }
        
        // Search functionality
        searchField.addKeyListener(new KeyAdapter() {
            @Override
            public void keyReleased(KeyEvent e) {
                String searchText = searchField.getText().toLowerCase();
                for (JCheckBox checkbox : serviceCheckboxes) {
                    boolean visible = checkbox.getText().toLowerCase().contains(searchText);
                    checkbox.setVisible(visible);
                }
                servicesPanel.revalidate();
                servicesPanel.repaint();
            }
        });
        
        // Select/Deselect all functionality
        selectAllButton.addActionListener(e -> {
            for (JCheckBox checkbox : serviceCheckboxes) {
                if (checkbox.isVisible()) {
                    checkbox.setSelected(true);
                }
            }
        });
        
        deselectAllButton.addActionListener(e -> {
            for (JCheckBox checkbox : serviceCheckboxes) {
                checkbox.setSelected(false);
            }
        });

        // Manual add functionality (silent persist)
        addServiceButton.addActionListener(e -> {
            String newService = manualField.getText().trim();
            if (newService.isEmpty()) {
                appendOut("\u26a0 Service name empty, not added\n");
                return;
            }
            // Check duplicates (case-insensitive)
            for (JCheckBox cb : serviceCheckboxes) {
                if (cb.getText().equalsIgnoreCase(newService)) {
                    appendStyled("\u2139 Service already exists: " + newService + "\n", C_INFO, false);
                    return;
                }
            }
            JCheckBox checkbox = new JCheckBox(newService);
            checkbox.setFont(new Font("Segoe UI", Font.PLAIN, 13));
            checkbox.setBackground(Color.WHITE);
            checkbox.setForeground(new Color(33, 37, 41));
            checkbox.setBorder(BorderFactory.createEmptyBorder(8, 10, 8, 10));
            checkbox.setFocusPainted(false);
            checkbox.setIcon(createCheckboxIcon(false));
            checkbox.setSelectedIcon(createCheckboxIcon(true));
            checkbox.setRolloverIcon(createCheckboxIcon(false, true));
            checkbox.setRolloverSelectedIcon(createCheckboxIcon(true, true));
            checkbox.addMouseListener(new MouseAdapter() {
                @Override
                public void mouseEntered(MouseEvent e) { checkbox.setBackground(new Color(248,249,250)); }
                @Override
                public void mouseExited(MouseEvent e) { checkbox.setBackground(Color.WHITE); }
            });
            // Auto-select the newly added service
            checkbox.setSelected(true);
            serviceCheckboxes.add(checkbox);
            servicesPanel.add(checkbox);
            servicesPanel.revalidate();
            servicesPanel.repaint();

            // Persist immediately (replacement mode) with SILENT output
            List<String> selectedServices = new ArrayList<>();
            for (JCheckBox cb : serviceCheckboxes) {
                if (cb.isSelected()) {
                    selectedServices.add(cb.getText());
                }
            }
            updateServicesFile(selectedServices, false); // silent
            configuration.setCustom(String.join(",", selectedServices));
            appendOut("\u2713 Added new service: " + newService + "\n");
            manualField.setText("");
        });
        
        JScrollPane scrollPane = new JScrollPane(servicesPanel);
        scrollPane.setBorder(BorderFactory.createLineBorder(new Color(220, 220, 220), 1));
        scrollPane.setBackground(Color.WHITE);
        scrollPane.getVerticalScrollBar().setUnitIncrement(16);
        contentPanel.add(scrollPane, BorderLayout.CENTER);
        
        dialog.add(contentPanel, BorderLayout.CENTER);
        
        // Modern button panel
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        buttonPanel.setBackground(new Color(250, 250, 250));
        buttonPanel.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createMatteBorder(1, 0, 0, 0, new Color(220, 220, 220)),
            BorderFactory.createEmptyBorder(15, 25, 15, 25)
        ));
        
        JButton cancelButton = createStyledButton("Cancel", new Color(108, 117, 125), Color.WHITE);
        cancelButton.addActionListener(e -> dialog.dispose());
        buttonPanel.add(cancelButton);
        
        JButton confirmButton = createStyledButton("Apply Selection", new Color(0, 123, 255), Color.WHITE);
        confirmButton.addActionListener(e -> {
            List<String> selectedServices = new ArrayList<>();
            for (JCheckBox checkbox : serviceCheckboxes) {
                if (checkbox.isSelected()) {
                    selectedServices.add(checkbox.getText());
                }
            }
            
            if (!selectedServices.isEmpty()) {
                updateServicesFile(selectedServices, false); // silent
                configuration.setCustom(String.join(",", selectedServices));
                appendOut("\u2713 Custom services updated: " + selectedServices.size() + " services selected\n");
                appendStyled("  Selected: " + String.join(", ", selectedServices) + "\n\n", C_INFO, false);
            } else {
                appendOut("\u26a0 No services selected for custom configuration\n\n");
            }
            
            dialog.dispose();
        });
        buttonPanel.add(confirmButton);
        
        dialog.add(buttonPanel, BorderLayout.SOUTH);
        
        // Show dialog
        dialog.setVisible(true);
    }

    // Custom thicker caret to improve visibility of typing position
    @SuppressWarnings("serial")
    private static class ThickCaret extends javax.swing.text.DefaultCaret {
        private static final int WIDTH = 2; // thickness in pixels
        @Override
        protected synchronized void damage(java.awt.Rectangle r) {
            if (r == null) return;
            // Repaint a little wider for the thick caret
            x = r.x; y = r.y; width = r.width + WIDTH; height = r.height;
            repaint();
        }
        @Override
        public void paint(java.awt.Graphics g) {
            javax.swing.text.JTextComponent comp = getComponent();
            if (comp == null) return;
            if (!isVisible()) return;
            try {
                // Use modern modelToView2D (modelToView(int) is deprecated). Fallback guarded.
                java.awt.geom.Rectangle2D r2d = comp.modelToView2D(getDot());
                if (r2d == null) return;
                java.awt.Rectangle r = r2d.getBounds();
                g.setColor(comp.getCaretColor());
                int caretWidth = WIDTH;
                g.fillRect(r.x, r.y, caretWidth, r.height);
            } catch (javax.swing.text.BadLocationException e) {
                // Ignore bad location
            }
        }
    }
    
    private Icon createCheckboxIcon(boolean selected) {
        return createCheckboxIcon(selected, false);
    }
    
    private Icon createCheckboxIcon(boolean selected, boolean hover) {
        return new Icon() {
            @Override
            public void paintIcon(Component c, Graphics g, int x, int y) {
                Graphics2D g2d = (Graphics2D) g.create();
                g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                
                // Background
                if (selected) {
                    g2d.setColor(new Color(0, 123, 255));
                } else {
                    g2d.setColor(hover ? new Color(248, 249, 250) : Color.WHITE);
                }
                g2d.fillRoundRect(x, y, 16, 16, 3, 3);
                
                // Border
                g2d.setColor(selected ? new Color(0, 123, 255) : (hover ? new Color(0, 123, 255) : new Color(220, 220, 220)));
                g2d.setStroke(new BasicStroke(1.5f));
                g2d.drawRoundRect(x, y, 16, 16, 3, 3);
                
                // Checkmark
                if (selected) {
                    g2d.setColor(Color.WHITE);
                    g2d.setStroke(new BasicStroke(2f));
                    g2d.drawLine(x + 4, y + 8, x + 7, y + 11);
                    g2d.drawLine(x + 7, y + 11, x + 12, y + 5);
                }
                
                g2d.dispose();
            }
            
            @Override
            public int getIconWidth() { return 16; }
            
            @Override
            public int getIconHeight() { return 16; }
        };
    }

    private void updateServicesFile(List<String> selectedServices, boolean verbose) {
        // Prefer the internal Services.py inside the UltraKibanaDownloader package.
        File rootFile = new File(projectRoot, "Services.py");
        File subDir = new File(projectRoot, "UltraKibanaDownloader");
        File subFile = new File(subDir, "Services.py");
        // Ensure package folder exists so we can create/update internal Services.py
        if (!subDir.exists()) {
            subDir.mkdirs();
        }
        File target = subFile; // always prefer internal Services.py

        if (verbose) {
            appendStyled(String.format("[DEBUG] rootFile=%s exists=%s | subFile=%s exists=%s | chosen(internal)=%s\n",
                    rootFile.getAbsolutePath(), rootFile.exists(),
                    subFile.getAbsolutePath(), subFile.exists(),
                    target.getAbsolutePath()), C_DIM, false);
            File parentDir = target.getParentFile();
            if (parentDir != null && parentDir.isDirectory()) {
                String[] files = parentDir.list();
                if (files != null) {
                    appendStyled("[DEBUG] Directory listing (" + parentDir.getName() + "): " + String.join(", ", files) + "\n", C_DIM, false);
                }
            }
            appendStyled("Note: application will use and update the internal UltraKibanaDownloader/Services.py. Root-level Services.py will be ignored for runtime.\n", C_DIM, false);
        }

        try {
            // Replacement mode: services block should reflect ONLY current selectedServices
            // Preserve other sections (tags, filters, etc.). Remove any previous duplicate headers.
            StringBuilder preservedSections = new StringBuilder();
            boolean insideServicesBlock = false;
            if (target.exists()) {
                try (BufferedReader reader = new BufferedReader(new FileReader(target))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        String trimmed = line.trim();
                        if (trimmed.startsWith("services = [")) {
                            insideServicesBlock = true; // skip old services block
                            continue;
                        }
                        if (insideServicesBlock) {
                            if (trimmed.startsWith("]")) {
                                insideServicesBlock = false; // finished skipping
                            }
                            continue; // skip lines within old services block
                        }
                        // Drop stray duplicate headers to avoid accumulation
                        if (trimmed.equals("# Services to look for")) {
                            // Skip existing headers; we'll add one fresh at top
                            continue;
                        }
                        preservedSections.append(line).append("\n");
                    }
                }
            }

            // Build fresh services block
            StringBuilder newContent = new StringBuilder();
            newContent.append("# Services to look for\n");
            newContent.append("services = [\n");
            for (String svc : selectedServices) {
                newContent.append("    \"").append(svc).append("\",\n");
            }
            newContent.append("]\n\n");
            newContent.append(preservedSections);

            // Atomic write: write to temp file then move/replace
            File tempFile = new File(target.getParentFile(), target.getName() + ".tmp");
            try (FileWriter writer = new FileWriter(tempFile)) {
                writer.write(newContent.toString());
            }
            Files.move(tempFile.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
            if (verbose) {
                appendStyled("Services.py updated successfully at: " + target.getAbsolutePath() + "\n", C_SUCCESS, false);
            }

            // Do NOT mirror to root; keep Services.py inside the package only.
            if (verbose) {
                appendStyled("[INFO] Services.py updated inside UltraKibanaDownloader/ and root copy will not be created or modified.\n", C_DIM, false);
            }
        } catch (IOException e) {
            appendOut("Error updating Services.py: " + e.getMessage() + "\n");
        }
    }

    private void setCurrentDateTime() {
        dateField.setText(DATE_FORMAT.format(new Date()));
        configuration.setDate(getDateFieldText());
    }

    private String getDateFieldText() {
        return dateField.getText().trim();
    }

    /** Creates a JTextField that renders a gray italic placeholder when empty and unfocused. */
    private JTextField createHintTextField(String hint) {
        return new JTextField("", 20) {
            @Override
            protected void paintComponent(Graphics g) {
                super.paintComponent(g);
                if (getText().isEmpty() && !isFocusOwner()) {
                    Graphics2D g2 = (Graphics2D) g.create();
                    g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
                    g2.setColor(new Color(170, 170, 170));
                    g2.setFont(getFont().deriveFont(Font.ITALIC));
                    Insets ins = getInsets();
                    FontMetrics fm = g2.getFontMetrics();
                    g2.drawString(hint, ins.left + 2, ins.top + fm.getAscent());
                    g2.dispose();
                }
            }
        };
    }

    /** Attaches a DocumentListener that keeps the label text in sync with the active keyword count. */
    private void attachKeywordLabel(JTextField field, JLabel label, String baseText) {
        Runnable update = () -> {
            String txt = field.getText().trim();
            long count = txt.isEmpty() ? 0 :
                java.util.Arrays.stream(txt.split(",")).map(String::trim).filter(s -> !s.isEmpty()).count();
            if (count > 0) {
                label.setText("<html><b>" + baseText + " (" + count + "):</b></html>");
                label.setForeground(new Color(0, 115, 190));
            } else {
                label.setText(baseText + ":");
                label.setForeground(new Color(33, 37, 41));
            }
        };
        field.getDocument().addDocumentListener(new javax.swing.event.DocumentListener() {
            public void insertUpdate(javax.swing.event.DocumentEvent e)  { update.run(); }
            public void removeUpdate(javax.swing.event.DocumentEvent e)  { update.run(); }
            public void changedUpdate(javax.swing.event.DocumentEvent e) { update.run(); }
        });
    }

    // Removed ConfigAggregator and summary logic; now displaying raw CFG block verbatim

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            try {
                new UltraKibanaDownloader();
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }
}
