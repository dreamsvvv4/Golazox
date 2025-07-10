import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

// Import our improved components
import model.Configuration;
import ui.components.AutoCompleteTextField;

public class ElasticLoganaGUI {

    // UI Components
    private JFrame frame;
    private AutoCompleteTextField dateField;
    private AutoCompleteTextField logsField;
    private JTextField timeRangeField;
    private JComboBox<String> timeUnitComboBox;
    private JTextField excludeField;
    private JTextField includeField;
    private JComboBox<String> kibanaTypeComboBox;
    private JComboBox<String> countriesComboBox;
    private JComboBox<String> configComboBox;
    private JComboBox<String> idTypeComboBox;
    private AutoCompleteTextField idField;
    private JTextArea outputArea;
    private JProgressBar progressBar;
    private JLabel statusLabel;

    // Services and Model
    private final Configuration configuration;
    
    private final ExecutorService executorService = Executors.newFixedThreadPool(2);

    public ElasticLoganaGUI() {
        // Initialize services and model
        this.configuration = new Configuration();
        
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
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setLayout(new BorderLayout());
        
        // Set optimal size and center on screen
        frame.setSize(1400, 900);
        frame.setLocationRelativeTo(null);
        
        // Create split pane layout
        JSplitPane mainSplitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        mainSplitPane.setLeftComponent(createControlPanel());
        mainSplitPane.setRightComponent(createOutputPanel());
        mainSplitPane.setDividerLocation(500);
        mainSplitPane.setResizeWeight(0.3);
        mainSplitPane.setBorder(null);
        
        frame.add(mainSplitPane, BorderLayout.CENTER);
        frame.add(createStatusPanel(), BorderLayout.SOUTH);
        
        frame.setVisible(true);
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
        
        // Row 1: Date
        gbc.gridx = 0; gbc.gridy = 0; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel dateLabel = new JLabel("Date:");
        dateLabel.setFont(labelFont);
        dateLabel.setMinimumSize(new Dimension(120, 25));
        dateLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(dateLabel, gbc);
        
        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        dateField = new AutoCompleteTextField(configuration.getDate(), 20, new ArrayList<>());
        styleTextField(dateField);
        formPanel.add(dateField, gbc);
        
        // Row 2: ID Type
        gbc.gridx = 0; gbc.gridy = 1; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
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
        
        // Row 3: Enter ID
        gbc.gridx = 0; gbc.gridy = 2; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel idLabel = new JLabel("Enter ID:");
        idLabel.setFont(labelFont);
        idLabel.setMinimumSize(new Dimension(120, 25));
        idLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(idLabel, gbc);
        
        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        idField = new AutoCompleteTextField("", 20, new ArrayList<>());
        styleTextField(idField);
        formPanel.add(idField, gbc);
        
        // Row 4: Logs Path
        gbc.gridx = 0; gbc.gridy = 3; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel logsLabel = new JLabel("Logs Path:");
        logsLabel.setFont(labelFont);
        logsLabel.setMinimumSize(new Dimension(120, 25));
        logsLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(logsLabel, gbc);
        
        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        logsField = new AutoCompleteTextField(configuration.getLogs(), 20, new ArrayList<>());
        styleTextField(logsField);
        formPanel.add(logsField, gbc);
        
        // Row 5: Kibana
        gbc.gridx = 0; gbc.gridy = 4; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel kibanaLabel = new JLabel("Kibana:");
        kibanaLabel.setFont(labelFont);
        kibanaLabel.setMinimumSize(new Dimension(120, 25));
        kibanaLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(kibanaLabel, gbc);
        
        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        kibanaTypeComboBox = new JComboBox<>(new String[]{"OnCloud", "OnPremise"});
        styleComboBox(kibanaTypeComboBox);
        kibanaTypeComboBox.addActionListener(e -> updateKibanaType());
        formPanel.add(kibanaTypeComboBox, gbc);
        
        // Row 6: Country
        gbc.gridx = 0; gbc.gridy = 5; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel countryLabel = new JLabel("Country:");
        countryLabel.setFont(labelFont);
        countryLabel.setMinimumSize(new Dimension(120, 25));
        countryLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(countryLabel, gbc);
        
        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        countriesComboBox = new JComboBox<>(new String[]{"ES", "IT", "FR", "DE", "UK", "AR", "CL", "MX", "BR"});
        styleComboBox(countriesComboBox);
        countriesComboBox.addActionListener(e -> updateCountry());
        formPanel.add(countriesComboBox, gbc);
        
        // Row 7: Time Range
        gbc.gridx = 0; gbc.gridy = 6; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel timeRangeLabel = new JLabel("Time Range:");
        timeRangeLabel.setFont(labelFont);
        timeRangeLabel.setMinimumSize(new Dimension(120, 25));
        timeRangeLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(timeRangeLabel, gbc);
        
        // Create a panel for time range input
        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        JPanel timeRangePanel = new JPanel(new GridBagLayout());
        timeRangePanel.setBackground(Color.WHITE);
        GridBagConstraints timeGbc = new GridBagConstraints();
        
        // Time range number field
        timeGbc.gridx = 0; timeGbc.gridy = 0; timeGbc.weightx = 0.3; timeGbc.fill = GridBagConstraints.HORIZONTAL;
        timeGbc.insets = new Insets(0, 0, 0, 5);
        timeRangeField = new JTextField("30", 8);
        styleTextField(timeRangeField);
        timeRangePanel.add(timeRangeField, timeGbc);
        
        // Time unit combo box
        timeGbc.gridx = 1; timeGbc.weightx = 0.7; timeGbc.fill = GridBagConstraints.HORIZONTAL;
        timeGbc.insets = new Insets(0, 0, 0, 0);
        timeUnitComboBox = new JComboBox<>(new String[]{"minutes", "hours", "days", "weeks"});
        timeUnitComboBox.setSelectedItem("minutes");
        styleComboBox(timeUnitComboBox);
        timeRangePanel.add(timeUnitComboBox, timeGbc);
        
        formPanel.add(timeRangePanel, gbc);
        
        // Row 8: Config
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
        
        // Row 9: Include
        gbc.gridx = 0; gbc.gridy = 8; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel includeLabel = new JLabel("Include:");
        includeLabel.setFont(labelFont);
        includeLabel.setMinimumSize(new Dimension(120, 25));
        includeLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(includeLabel, gbc);
        
        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        includeField = new JTextField("", 20);
        styleTextField(includeField);
        formPanel.add(includeField, gbc);
        
        // Row 10: Exclude
        gbc.gridx = 0; gbc.gridy = 9; gbc.weightx = 0.0; gbc.fill = GridBagConstraints.NONE;
        JLabel excludeLabel = new JLabel("Exclude:");
        excludeLabel.setFont(labelFont);
        excludeLabel.setMinimumSize(new Dimension(120, 25));
        excludeLabel.setPreferredSize(new Dimension(120, 25));
        formPanel.add(excludeLabel, gbc);
        
        gbc.gridx = 1; gbc.weightx = 1.0; gbc.fill = GridBagConstraints.HORIZONTAL;
        excludeField = new JTextField("", 20);
        styleTextField(excludeField);
        formPanel.add(excludeField, gbc);
        
        return formPanel;
    }

    private JPanel createButtonPanel() {
        JPanel buttonPanel = new JPanel(new GridLayout(2, 2, 10, 10));
        buttonPanel.setBackground(Color.WHITE);
        buttonPanel.setBorder(BorderFactory.createEmptyBorder(20, 0, 0, 0));
        
        // Create essential buttons
        JButton downloadButton = createStyledButton("Download", new Color(0, 123, 255), Color.WHITE);
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
        
        return buttonPanel;
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

        // Output area with dark console theme
        outputArea = new JTextArea();
        outputArea.setFont(new Font("Consolas", Font.PLAIN, 12));
        outputArea.setBackground(new Color(40, 44, 52));
        outputArea.setForeground(new Color(171, 178, 191));
        outputArea.setMargin(new Insets(15, 15, 15, 15));
        outputArea.setEditable(false);
        outputArea.setLineWrap(true);
        outputArea.setWrapStyleWord(true);
        outputArea.setText("Ultra KibanaDownloader Console\n" +
                          "Ready to download logs. Configure parameters and click 'Download'.\n\n");

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

        // Progress bar
        progressBar = new JProgressBar();
        progressBar.setVisible(false);
        progressBar.setStringPainted(true);
        statusPanel.add(progressBar, BorderLayout.CENTER);

        // Copyright
        JLabel copyright = new JLabel("© 2025 Verisure - Ultra KibanaDownloader");
        copyright.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        copyright.setForeground(new Color(134, 142, 150));
        statusPanel.add(copyright, BorderLayout.EAST);

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
        
        // Add focus effect
        field.addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(FocusEvent e) {
                field.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(new Color(0, 123, 255), 2),
                    BorderFactory.createEmptyBorder(7, 11, 7, 11)
                ));
            }
            
            @Override
            public void focusLost(FocusEvent e) {
                field.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(new Color(220, 220, 220), 1),
                    BorderFactory.createEmptyBorder(8, 12, 8, 12)
                ));
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
        });
    }

    // Progress tracking
    private int maxLogsToRetrieve = 0;
    
    private void downloadLogs() {
        // Reset progress tracking
        maxLogsToRetrieve = 0;
        
        updateConfiguration();
        
        // Validate required fields
        if (idField.getText().trim().isEmpty()) {
            outputArea.append("\nError: ID field is required!\n\n");
            updateError("ID field is required");
            outputArea.setCaretPosition(outputArea.getDocument().getLength());
            return;
        }
        
        if (dateField.getText().trim().isEmpty()) {
            outputArea.append("\nError: Date field is required!\n\n");
            updateError("Date field is required");
            outputArea.setCaretPosition(outputArea.getDocument().getLength());
            return;
        }
        
        if (timeRangeField.getText().trim().isEmpty()) {
            outputArea.append("\nError: Time range field is required!\n\n");
            updateError("Time range field is required");
            outputArea.setCaretPosition(outputArea.getDocument().getLength());
            return;
        }
        
        try {
            Integer.parseInt(timeRangeField.getText().trim());
        } catch (NumberFormatException e) {
            outputArea.append("\nError: Time range must be a valid number!\n\n");
            updateError("Time range must be a valid number");
            outputArea.setCaretPosition(outputArea.getDocument().getLength());
            return;
        }
        
        outputArea.append("\n=== LOG DOWNLOAD STARTED ===\n");
        outputArea.append("Date: " + configuration.getDate() + "\n");
        outputArea.append("Time Range: " + timeRangeField.getText() + " " + timeUnitComboBox.getSelectedItem() + " backwards\n");
        outputArea.append("ID (" + configuration.getIdType() + "): " + idField.getText() + "\n");
        outputArea.append("Config: " + configuration.getSelectedConfig());
        if (!configuration.getCustom().trim().isEmpty()) {
            outputArea.append(" (" + configuration.getCustom() + ")");
        }
        outputArea.append("\n");
        outputArea.append("Environment: " + configuration.getKibanaType() + " / " + configuration.getCountry() + "\n");
        if (!configuration.getIncludeKeywords().trim().isEmpty()) {
            outputArea.append("Include: " + configuration.getIncludeKeywords() + "\n");
        }
        if (!configuration.getExcludeKeywords().trim().isEmpty()) {
            outputArea.append("Exclude: " + configuration.getExcludeKeywords() + "\n");
        }
        outputArea.append("\n[NOTE] Searching backwards from the specified date/time.\n");
        outputArea.append("If no logs found, try expanding the time range or adjusting the date.\n\n");
        
        updateStatus("Downloading logs...");
        showProgress(true);
        
        executorService.submit(() -> {
            try {
                // Find Python executable
                String pythonPath = findPythonPath();
                if (pythonPath == null) {
                    SwingUtilities.invokeLater(() -> {
                        outputArea.append("Error: Python executable not found.\n\n");
                        updateError("Python executable not found");
                        showProgress(false);
                        outputArea.setCaretPosition(outputArea.getDocument().getLength());
                    });
                    return;
                }
                
                // Build command using ProcessBuilder for better argument handling
                List<String> commandList = new ArrayList<>();
                commandList.add(pythonPath);
                commandList.add("main.py");
                
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
                
                // Add verbose flag
                commandList.add("-v");
                
                // Add logs path
                commandList.add("-p");
                commandList.add(configuration.getLogs());
                
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
                
                // Add kibana environment
                if ("OnCloud".equals(configuration.getKibanaType())) {
                    commandList.add("-n");
                    commandList.add("aws");
                } else {
                    commandList.add("-n");
                    commandList.add("vs");
                }
                
                // Add country
                commandList.add("-c");
                commandList.add(configuration.getCountry());
                
                // Add start and end minutes (using time range for looking back)
                try {
                    int minutes = Integer.parseInt(configuration.getTraces());
                    commandList.add("-s");
                    commandList.add(String.valueOf(minutes)); // Look back this many minutes
                    commandList.add("-e");
                    commandList.add("0"); // End at the specified date
                } catch (NumberFormatException e) {
                    commandList.add("-s");
                    commandList.add("10");
                    commandList.add("-e");
                    commandList.add("0");
                }
                
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
                
                // Display command being executed
                SwingUtilities.invokeLater(() -> {
                    outputArea.append("Executing: " + String.join(" ", commandList) + "\n\n");
                    outputArea.setCaretPosition(outputArea.getDocument().getLength());
                });
                
                // Execute the Python script
                ProcessBuilder pb = new ProcessBuilder(commandList);
                pb.directory(new File(System.getProperty("user.dir")));
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
                            
                            // Display progress in a more prominent way
                            outputArea.append(">>> " + progressMessage + "\n");
                            
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
                                        progressBar.setValue((int) percent);
                                        
                                        // Extract count for status
                                        String[] parts = progressMessage.split(" ");
                                        for (int i = 0; i < parts.length - 1; i++) {
                                            if ("Retrieved".equals(parts[i]) && parts[i + 1].contains("/")) {
                                                String countPart = parts[i + 1];
                                                String currentCount = countPart.substring(0, countPart.indexOf("/"));
                                                updateStatus("Retrieved " + currentCount + " logs (" + (int) percent + "%)");
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
                            outputArea.append("-".repeat(50) + "\n");
                        } else if (outputLine.startsWith("DEBUG") && outputLine.contains("Retrieved") && outputLine.contains("logs so far")) {
                            // Handle DEBUG messages with progress information
                            try {
                                String[] parts = outputLine.split(" ");
                                for (int i = 0; i < parts.length - 1; i++) {
                                    if ("Retrieved".equals(parts[i]) && "logs".equals(parts[i + 2])) {
                                        String count = parts[i + 1];
                                        int currentCount = Integer.parseInt(count);
                                        
                                        // Calculate progress if we know the total
                                        if (maxLogsToRetrieve > 0) {
                                            float percentage = (currentCount / (float) maxLogsToRetrieve) * 100;
                                            progressBar.setValue((int) percentage);
                                            updateStatus("Retrieved " + count + " logs (" + String.format("%.1f", percentage) + "%)");
                                        } else {
                                            updateStatus("Retrieved " + count + " logs...");
                                        }
                                        
                                        outputArea.append(">>> Retrieved " + count + " logs so far...\n");
                                        break;
                                    }
                                }
                            } catch (Exception e) {
                                outputArea.append(outputLine + "\n");
                            }
                        } else if (outputLine.startsWith("DEBUG") && outputLine.contains("Using scroll API")) {
                            // Handle scroll API debug message and extract max count
                            try {
                                // Look for pattern "Using scroll API for large result set of XXXXX"
                                if (outputLine.contains("result set of")) {
                                    String[] parts = outputLine.split("result set of ");
                                    if (parts.length > 1) {
                                        String maxCount = parts[1].trim();
                                        maxLogsToRetrieve = Integer.parseInt(maxCount);
                                        outputArea.append(">>> Using scroll API - will retrieve up to " + maxCount + " logs\n");
                                        updateStatus("Preparing to retrieve up to " + maxCount + " logs...");
                                        
                                        // Set progress bar to determinate mode
                                        progressBar.setIndeterminate(false);
                                        progressBar.setValue(0);
                                    }
                                } else {
                                    outputArea.append(">>> Using scroll API for large result set\n");
                                    updateStatus("Using scroll API for large download...");
                                }
                            } catch (Exception e) {
                                outputArea.append(">>> Using scroll API for large result set\n");
                                updateStatus("Using scroll API for large download...");
                            }
                        } else if (outputLine.startsWith("DEBUG") && outputLine.contains("Total logs found")) {
                            // Handle total logs found debug message
                            try {
                                String[] parts = outputLine.split(" ");
                                for (int i = 0; i < parts.length - 1; i++) {
                                    if ("found:".equals(parts[i])) {
                                        String totalCount = parts[i + 1];
                                        outputArea.append(">>> Total logs found: " + totalCount + "\n");
                                        updateStatus("Found " + totalCount + " logs total");
                                        break;
                                    }
                                }
                            } catch (Exception e) {
                                outputArea.append(outputLine + "\n");
                            }
                        } else if (outputLine.startsWith("DEBUG")) {
                            // Show device configuration and parsing information
                            if (outputLine.contains("Parsing kibana log")) {
                                outputArea.append("=== DEVICE CONFIGURATION PARSING ===\n");
                            } else if (outputLine.contains("Installation Number") || 
                                       outputLine.contains("SN ") || 
                                       outputLine.contains("->") ||
                                       outputLine.contains("MAC:") ||
                                       outputLine.contains("frames:") ||
                                       outputLine.contains("Logs found") ||
                                       outputLine.contains("Exiting app")) {
                                
                                // Clean device info display
                                if (outputLine.contains("Installation Number")) {
                                    String[] parts = outputLine.split("Installation Number ");
                                    if (parts.length > 1) {
                                        outputArea.append("Installation ID: " + parts[1].trim() + "\n");
                                    }
                                } else if (outputLine.contains("SN ")) {
                                    String[] parts = outputLine.split("SN ");
                                    if (parts.length > 1) {
                                        outputArea.append("Serial Number: " + parts[1].trim() + "\n");
                                    }
                                } else if (outputLine.contains("->")) {
                                    String cleanLine = outputLine.replace("DEBUG", "").trim();
                                    outputArea.append("Device: " + cleanLine + "\n");
                                } else if (outputLine.contains("frames:")) {
                                    String cleanLine = outputLine.replace("DEBUG", "").trim();
                                    outputArea.append("Config: " + cleanLine + "\n");
                                } else if (outputLine.contains("Logs found")) {
                                    String[] parts = outputLine.split("Logs found ");
                                    if (parts.length > 1) {
                                        outputArea.append("Query matched: " + parts[1].trim() + " logs\n");
                                    }
                                } else if (outputLine.contains("Exiting app")) {
                                    outputArea.append("Configuration parsing completed\n");
                                }
                            }
                        } else if (outputLine.trim().isEmpty()) {
                            // Skip empty lines
                        } else {
                            // Regular output line
                            outputArea.append(outputLine + "\n");
                        }
                        outputArea.setCaretPosition(outputArea.getDocument().getLength());
                    });
                }
                
                int exitCode = process.waitFor();
                
                SwingUtilities.invokeLater(() -> {
                    if (exitCode == 0) {
                        outputArea.append("\n=== DOWNLOAD COMPLETED ===\n");
                        outputArea.append("Files saved to: " + configuration.getLogs() + "\n");
                        
                        // Show generated files
                        showGeneratedFiles();
                        
                        // Check if any logs were actually found
                        if (outputArea.getText().contains("Retrieved 0/0 logs") || outputArea.getText().contains("Final result: 0 logs retrieved")) {
                            outputArea.append("\n[WARNING] No logs found for the specified criteria.\n");
                            outputArea.append("Try expanding the time range or adjusting the search parameters.\n\n");
                            updateStatus("No logs found - check search criteria");
                        } else {
                            outputArea.append("\nUse 'Open Log' to view files or 'Export ZIP' to create an archive.\n\n");
                            updateStatus("Download completed");
                        }
                    } else {
                        outputArea.append("\n=== DOWNLOAD FAILED ===\n");
                        outputArea.append("Exit code: " + exitCode + "\n\n");
                        updateError("Download failed");
                    }
                    showProgress(false);
                    outputArea.setCaretPosition(outputArea.getDocument().getLength());
                });
                
            } catch (Exception e) {
                SwingUtilities.invokeLater(() -> {
                    outputArea.append("Error: " + e.getMessage() + "\n\n");
                    updateError(e.getMessage());
                    showProgress(false);
                    outputArea.setCaretPosition(outputArea.getDocument().getLength());
                });
            }
        });
    }
    
    private String getConfigFile(String configName) {
        switch (configName) {
            case "Photos": return "confPhoto";
            case "Calls": return "confAudio";
            case "Communications": return "confM2M";
            case "Doorlock": return "ConfDoorlock";
            case "FOTA": return "ConfFOTA";
            case "Custom": return "Services";
            case "All":
            default: return "confForensic";
        }
    }
    
    private void showGeneratedFiles() {
        String logsPath = configuration.getLogs();
        File logsDir = new File(logsPath);
        if (logsDir.exists()) {
            File[] logFiles = logsDir.listFiles((dir, name) -> 
                name.toLowerCase().endsWith(".log") || name.toLowerCase().endsWith(".txt"));
            if (logFiles != null && logFiles.length > 0) {
                outputArea.append("Generated files:\n");
                for (File file : logFiles) {
                    outputArea.append("  - " + file.getName() + " (" + file.length() + " bytes)\n");
                }
            }
        }
    }

    private void openLog() {
        try {
            String logsPath = configuration.getLogs();
            File logsDir = new File(logsPath);
            
            if (!logsDir.exists()) {
                outputArea.append("\nError: Logs directory does not exist: " + logsPath + "\n\n");
                updateError("Logs directory not found");
                outputArea.setCaretPosition(outputArea.getDocument().getLength());
                return;
            }
            
            File mostRecentFile = findMostRecentLogFile(logsDir, "ordered.log");
            
            if (mostRecentFile == null) {
                outputArea.append("\nNo log files found in: " + logsPath + "\n");
                outputArea.append("Please run Download first to generate log files.\n\n");
                updateError("No log files found");
                outputArea.setCaretPosition(outputArea.getDocument().getLength());
                return;
            }
            
            if (Desktop.isDesktopSupported()) {
                Desktop desktop = Desktop.getDesktop();
                desktop.open(mostRecentFile);
                outputArea.append("\nOpening log file: " + mostRecentFile.getName() + "\n");
                outputArea.append("File path: " + mostRecentFile.getAbsolutePath() + "\n");
                outputArea.append("File opened in default editor.\n\n");
                updateStatus("Log file opened: " + mostRecentFile.getName());
            } else {
                outputArea.append("\nDesktop not supported. Cannot open file automatically.\n");
                outputArea.append("Please manually open: " + mostRecentFile.getAbsolutePath() + "\n\n");
                updateError("Desktop not supported");
            }
            
        } catch (Exception e) {
            outputArea.append("\nError opening log file: " + e.getMessage() + "\n\n");
            updateError("Failed to open log file: " + e.getMessage());
        }
        
        outputArea.setCaretPosition(outputArea.getDocument().getLength());
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
                outputArea.append("\nError: Logs directory does not exist: " + logsPath + "\n\n");
                updateError("Logs directory not found");
                outputArea.setCaretPosition(outputArea.getDocument().getLength());
                return;
            }
            
            // Find the most recent log directory
            File mostRecentDir = findMostRecentLogDirectory(logsDir);
            
            if (mostRecentDir == null) {
                outputArea.append("\nNo log directories found in: " + logsPath + "\n");
                outputArea.append("Please run Download first to generate log files.\n\n");
                updateError("No log directories found");
                outputArea.setCaretPosition(outputArea.getDocument().getLength());
                return;
            }
            
            // Get all log files from the most recent directory
            File[] logFiles = mostRecentDir.listFiles((dir, name) -> 
                name.toLowerCase().endsWith(".log") || name.toLowerCase().endsWith(".txt"));
            
            if (logFiles == null || logFiles.length == 0) {
                outputArea.append("\nNo log files found in: " + mostRecentDir.getAbsolutePath() + "\n");
                outputArea.append("Please run Download first to generate log files.\n\n");
                updateError("No log files found");
                outputArea.setCaretPosition(outputArea.getDocument().getLength());
                return;
            }
            
            // Create ZIP file name based on the directory name
            String zipName = mostRecentDir.getName() + "_logs.zip";
            File zipFile = new File(zipName);
            
            outputArea.append("\nExporting logs to ZIP...\n");
            outputArea.append("Source directory: " + mostRecentDir.getName() + "\n");
            outputArea.append("ZIP file: " + zipName + "\n");
            outputArea.append("Including " + logFiles.length + " log files:\n");
            
            // Create the ZIP file
            try (FileOutputStream fos = new FileOutputStream(zipFile);
                 ZipOutputStream zos = new ZipOutputStream(fos)) {
                
                for (File file : logFiles) {
                    outputArea.append("  - " + file.getName() + " (" + file.length() + " bytes)\n");
                    
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
                
                outputArea.append("\nZIP file created successfully: " + zipFile.getAbsolutePath() + "\n\n");
                updateStatus("ZIP export completed: " + zipName);
            }
            
        } catch (Exception e) {
            outputArea.append("\nError creating ZIP file: " + e.getMessage() + "\n\n");
            updateError("Failed to create ZIP file: " + e.getMessage());
        }
        
        outputArea.setCaretPosition(outputArea.getDocument().getLength());
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

    private void clearOutput() {
        outputArea.setText("Ultra KibanaDownloader Console\n" +
                          "Ready to download logs. Configure parameters and click 'Download'.\n\n");
        updateStatus("Output cleared");
    }

    private void updateConfiguration() {
        configuration.setDate(dateField.getText());
        configuration.setLogs(logsField.getText());
        configuration.setTraces(String.valueOf(getTimeRangeInMinutes()));
        configuration.setKibanaType((String) kibanaTypeComboBox.getSelectedItem());
        configuration.setCountry((String) countriesComboBox.getSelectedItem());
        configuration.setSelectedConfig((String) configComboBox.getSelectedItem());
        configuration.setIdType((String) idTypeComboBox.getSelectedItem());
        configuration.setIncludeKeywords(includeField.getText());
        configuration.setExcludeKeywords(excludeField.getText());
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

    private void loadConfiguration() {
        updateStatus("Using default configuration");
    }

    private void updateKibanaType() {
        configuration.setKibanaType((String) kibanaTypeComboBox.getSelectedItem());
    }

    private void updateCountry() {
        configuration.setCountry((String) countriesComboBox.getSelectedItem());
    }

    private void updateConfig() {
        String selectedConfig = (String) configComboBox.getSelectedItem();
        configuration.setSelectedConfig(selectedConfig);
        
        // If "Custom" is selected, open service selection dialog
        if ("Custom".equals(selectedConfig)) {
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
        // Read the base config file
        String baseConfigFile = getConfigFile(baseConfigName) + ".py";
        StringBuilder customConfig = new StringBuilder();
        
        try (BufferedReader reader = new BufferedReader(new FileReader(baseConfigFile))) {
            String line;
            
            while ((line = reader.readLine()) != null) {
                if (line.trim().startsWith("services = [")) {
                    // Replace the services section with custom services
                    customConfig.append("services = [\n");
                    String[] services = customServices.split(",");
                    for (int i = 0; i < services.length; i++) {
                        String service = services[i].trim();
                        if (!service.isEmpty()) {
                            customConfig.append("    \"").append(service).append("\"");
                            if (i < services.length - 1) {
                                customConfig.append(",");
                            }
                            customConfig.append("\n");
                        }
                    }
                    customConfig.append("]\n");
                    
                    // Skip until the end of the original services array
                    while ((line = reader.readLine()) != null) {
                        if (line.trim().equals("]")) {
                            break;
                        }
                    }
                } else {
                    customConfig.append(line).append("\n");
                }
            }
        }
        
        // Always overwrite Services.py for custom configurations
        String customConfigFile = "Services.py";
        
        try (PrintWriter writer = new PrintWriter(new FileWriter(customConfigFile))) {
            writer.print(customConfig.toString());
        }
        
        return "Services";  // Return the module name without .py extension
    }

    private String findPythonPath() {
        String os = System.getProperty("os.name").toLowerCase();
        try {
            ProcessBuilder processBuilder;
            if (os.contains("win")) {
                processBuilder = new ProcessBuilder("cmd.exe", "/c", "where python");
            } else {
                processBuilder = new ProcessBuilder("which", "python3");
            }
            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String pythonPath = reader.readLine();
                process.waitFor();
                if (pythonPath != null && !pythonPath.trim().isEmpty()) {
                    return pythonPath.trim();
                } else if (!os.contains("win")) {
                    processBuilder = new ProcessBuilder("which", "python");
                    processBuilder.redirectErrorStream(true);
                    process = processBuilder.start();
                    try (BufferedReader reader2 = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                        pythonPath = reader2.readLine();
                        process.waitFor();
                        if (pythonPath != null && !pythonPath.trim().isEmpty()) {
                            return pythonPath.trim();
                        }
                    }
                }
            }
        } catch (IOException | InterruptedException e) {
            outputArea.append("Error finding Python: " + e.getMessage() + "\n");
        }
        
        return os.contains("win") ? "python" : "python3";
    }

    private void openServiceSelectionDialog() {
        String[] allServices = {
            "cuxscored", "cuxsdialerd", "cuxs-situationd", "cuxs-rengined", "cuxsinstallerd",
            "cuxsupdaterd", "cuxszapatofonod", "gsmsrv", "cuxs-ired", "ofonod",
            "cuxspaparazzod", "cuxs-wired", "cuxs-wised", "cuxs-auditord", "cuxs-fenixd",
            "cuxs-powerd", "cuxs-timed", "xundertakerd", "cuxs-cm4-manager", "cuxscoprocessorloggerd",
            "cuxs-dect-setup", "cuxs-msp-manager", "xnotariod"
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
        
        // Search panel
        JPanel searchPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        searchPanel.setBackground(Color.WHITE);
        searchPanel.setBorder(BorderFactory.createEmptyBorder(0, 0, 15, 0));
        
        JLabel searchLabel = new JLabel("Filter services:");
        searchLabel.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        searchLabel.setForeground(new Color(108, 117, 125));
        searchPanel.add(searchLabel);
        
        JTextField searchField = new JTextField(20);
        styleTextField(searchField);
        searchPanel.add(searchField);
        
        JButton selectAllButton = createStyledButton("Select All", new Color(40, 167, 69), Color.WHITE);
        selectAllButton.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        selectAllButton.setBorder(BorderFactory.createEmptyBorder(6, 12, 6, 12));
        searchPanel.add(selectAllButton);
        
        JButton deselectAllButton = createStyledButton("Deselect All", new Color(108, 117, 125), Color.WHITE);
        deselectAllButton.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        deselectAllButton.setBorder(BorderFactory.createEmptyBorder(6, 12, 6, 12));
        searchPanel.add(deselectAllButton);
        
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
                updateServicesFile(selectedServices);
                configuration.setCustom(String.join(",", selectedServices));
                outputArea.append("✓ Custom services updated: " + selectedServices.size() + " services selected\n");
                outputArea.append("  Selected: " + String.join(", ", selectedServices) + "\n\n");
            } else {
                outputArea.append("⚠ No services selected for custom configuration\n\n");
            }
            
            dialog.dispose();
        });
        buttonPanel.add(confirmButton);
        
        dialog.add(buttonPanel, BorderLayout.SOUTH);
        
        // Show dialog
        dialog.setVisible(true);
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

    private void updateServicesFile(List<String> selectedServices) {
        try {
            String currentDir = System.getProperty("user.dir");
            File serviceFile = new File(currentDir, "Services.py");

            if (serviceFile.exists()) {
                try (BufferedReader reader = new BufferedReader(new FileReader(serviceFile))) {
                    StringBuilder newContent = new StringBuilder();
                    boolean insideServicesBlock = false;

                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (line.trim().startsWith("services = [")) {
                            insideServicesBlock = true;
                            newContent.append("services = [\n");
                            for (String service : selectedServices) {
                                newContent.append("    \"").append(service).append("\",\n");
                            }
                            newContent.append("]\n");
                        } else if (insideServicesBlock && line.trim().startsWith("]")) {
                            insideServicesBlock = false;
                        } else if (!insideServicesBlock) {
                            newContent.append(line).append("\n");
                        }
                    }

                    try (FileWriter writer = new FileWriter(serviceFile)) {
                        writer.write(newContent.toString());
                    }
                    outputArea.append("Services.py updated successfully.\n");
                }
            } else {
                outputArea.append("Error: Services.py file not found.\n");
            }
        } catch (IOException e) {
            outputArea.append("Error updating Services.py: " + e.getMessage() + "\n");
        }
    }

    private void setCurrentDateTime() {
        // Set date to 2 hours ago to ensure past logs are targeted
        LocalDateTime now = LocalDateTime.now().minusHours(2);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        String currentDateTime = now.format(formatter);
        
        dateField.setText(currentDateTime);
        configuration.setDate(currentDateTime);
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            new ElasticLoganaGUI();
        });
    }
}
