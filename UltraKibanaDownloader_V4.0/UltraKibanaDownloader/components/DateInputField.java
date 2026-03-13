package UltraKibanaDownloader.components;

import javax.swing.*;
import java.awt.*;
import java.awt.event.FocusEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import javax.swing.event.CaretListener;
import javax.swing.event.CaretEvent;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Custom date input field that avoids unwanted full selection on refocus
 * and validates format (yyyy-MM-dd HH:mm:ss) when focus is lost.
 */
public class DateInputField extends AutoCompleteTextField {
    private static final long serialVersionUID = 1L;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    // Posición del último click para restaurar el caret cuando el LAF hace selectAll
    private int lastClickOffset = -1;

    // Flag para permitir una sola vez selección completa (cuando el usuario realmente lo pide)
    private boolean allowFullSelectionOnce = false;

    @SuppressWarnings("this-escape")
    public DateInputField(String text, int columns, List<String> history) {
        super(text, Math.max(columns, 20), history); // fuerza mínimo 20 columnas
        setFont(new Font("Consolas", Font.PLAIN, 20)); // fuente monoespaciada y más grande
        setMargin(new Insets(8, 12, 8, 12)); // margen interno para evitar corte
        // Limpia error si el usuario modifica (sin necesidad de flag)
        getDocument().addDocumentListener(new javax.swing.event.DocumentListener() {
            public void insertUpdate(javax.swing.event.DocumentEvent e) { clearError(); }
            public void removeUpdate(javax.swing.event.DocumentEvent e) { clearError(); }
            public void changedUpdate(javax.swing.event.DocumentEvent e) { clearError(); }
        });
        setToolTipText("Formato: yyyy-MM-dd HH:mm:ss");

        // Forzar colores legibles independientemente del LAF
        setForeground(Color.BLACK);
        setBackground(Color.WHITE);
        setCaretColor(Color.BLACK);
        setSelectionColor(new Color(51, 153, 255));
        setSelectedTextColor(Color.WHITE);
        setOpaque(true);

        // Calcular tamaño preferido basado en la fuente para evitar que el LAF reduzca la anchura inicial
        FontMetrics fm = getFontMetrics(getFont());
        int chars = Math.max(getColumns(), 20);
        int prefWidth = fm.charWidth('0') * chars + getInsets().left + getInsets().right + 24;
        int prefHeight = Math.max(40, fm.getHeight() + getInsets().top + getInsets().bottom + 8);
        // Use a stable preferred width (avoid growing other fields unexpectedly)
        Dimension pref = new Dimension(300, prefHeight);
        setPreferredSize(pref);
        setMinimumSize(new Dimension(250, Math.max(36, prefHeight)));
        // Asegura que al añadirse al contenedor se revalide y repinte para evitar tamaños iniciales extraños
        SwingUtilities.invokeLater(() -> { revalidate(); repaint(); });

        // Focus listener: colapsa selección completa automática
        addFocusListener(new java.awt.event.FocusAdapter() {
            @Override
            public void focusGained(java.awt.event.FocusEvent e) {
                // Primera pasada inmediata
                SwingUtilities.invokeLater(() -> ensureNoFullSelection());
                // Segunda pasada (por si otro listener del LAF actúa después)
                new javax.swing.Timer(0, ev -> {
                    ensureNoFullSelection();
                    ((javax.swing.Timer)ev.getSource()).stop();
                }).start();
            }
        });

        // Registrar el offset real del click del usuario antes de que el LAF seleccione todo
        addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                try {
                    int offset;
                    try {
                        // Intentar método moderno (Java 9+)
                        java.lang.reflect.Method m = JTextField.class.getMethod("viewToModel2D", java.awt.geom.Point2D.class);
                        Object val = m.invoke(DateInputField.this, (java.awt.geom.Point2D)e.getPoint());
                        offset = (int) val;
                    } catch (Exception ignore) {
                        @SuppressWarnings("deprecation")
                        int tmp = viewToModel(e.getPoint());
                        offset = tmp;
                    }
                    lastClickOffset = offset;
                } catch (Exception ex) {
                    lastClickOffset = -1;
                }
            }
        });

        // CaretListener para detectar si se impuso selección completa después y revertirla
        addCaretListener(new CaretListener() {
            @Override
            public void caretUpdate(CaretEvent e) {
                if (getSelectedText() != null && getSelectedText().length() == getText().length()) {
                    ensureNoFullSelection();
                }
            }
        });

        // Key listener para detectar Ctrl+A y permitir esa selección completa
        addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_A && (e.isControlDown() || e.isMetaDown())) {
                    allowFullSelectionOnce = true; // permitir selectAll legítimo
                }
            }
        });

        // Mouse listener para permitir selección completa por doble/triple click explícito
        addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (e.getClickCount() >= 2) {
                    allowFullSelectionOnce = true;
                }
            }
        });
    }

    @Override
    public void addNotify() {
        super.addNotify();
        SwingUtilities.invokeLater(() -> {
            revalidate();
            repaint();
        });
    }

    @Override
    protected void processFocusEvent(FocusEvent e) {
        super.processFocusEvent(e);
        if (e.getID() == FocusEvent.FOCUS_LOST) {
            validateFormat();
        }
    }

    private void ensureNoFullSelection() {
        String sel = getSelectedText();
        if (sel != null && sel.length() == getText().length()) {
            int target = (lastClickOffset >= 0 && lastClickOffset <= getText().length()) ? lastClickOffset : getCaretPosition();
            select(target, target);
        }
    }

    @Override
    public void select(int selectionStart, int selectionEnd) {
        // Bloquear selección completa automática salvo que el usuario lo haya solicitado explícitamente
        if (selectionStart == 0 && selectionEnd == getText().length() && !allowFullSelectionOnce) {
            // Colapsar al caret actual (normalmente final o click)
            int caret = getCaretPosition();
            super.select(caret, caret);
            return;
        }
        super.select(selectionStart, selectionEnd);
        // Consumida la autorización puntual
        allowFullSelectionOnce = false;
    }

    private void validateFormat() {
        String value = getText().trim();
        if (value.isEmpty()) return;
        try {
            LocalDateTime.parse(value, FORMATTER);
            clearError();
        } catch (DateTimeParseException ex) {
            showError();
        }
    }

    private void showError() {
        setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(200, 0, 0), 2),
            BorderFactory.createEmptyBorder(7,11,7,11)
        ));
        setToolTipText("Formato inválido. Use yyyy-MM-dd HH:mm:ss");
    }

    private void clearError() {
        if (getToolTipText() != null && getToolTipText().startsWith("Formato inválido")) {
            setToolTipText("Formato: yyyy-MM-dd HH:mm:ss");
        }
    }

    @Override
    public Dimension getMinimumSize() {
        // Asegura un tamaño mínimo suficiente para el formato completo y altura legible
        return new Dimension(250, Math.max(36, super.getMinimumSize().height));
    }

    @Override
    public Dimension getPreferredSize() {
        // Asegura un tamaño preferido suficiente para el formato completo y altura legible
        return new Dimension(300, Math.max(40, super.getPreferredSize().height));
    }
}
