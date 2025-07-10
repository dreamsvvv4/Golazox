package ui.components;

import javax.swing.*;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.util.List;

/**
 * Custom text field with autocomplete functionality
 */
public class AutoCompleteTextField extends JTextField {
    
    private List<String> history;
    private JPopupMenu popup;
    
    public AutoCompleteTextField(String text, int columns, List<String> history) {
        super(text, columns);
        this.history = history;
        setupAutoComplete();
    }
    
    private void setupAutoComplete() {
        addFocusListener(new FocusAdapter() {
            @Override
            public void focusLost(FocusEvent e) {
                String value = getText();
                if (!value.isEmpty() && !history.contains(value)) {
                    history.add(value);
                }
            }
        });
        
        addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_DOWN && !history.isEmpty()) {
                    showAutoCompletePopup();
                } else if (e.getKeyCode() == KeyEvent.VK_ESCAPE && popup != null && popup.isVisible()) {
                    popup.setVisible(false);
                }
            }
            
            @Override
            public void keyReleased(KeyEvent e) {
                if (e.getKeyCode() != KeyEvent.VK_DOWN && e.getKeyCode() != KeyEvent.VK_ESCAPE) {
                    updateAutoCompletePopup();
                }
            }
        });
    }
    
    private void showAutoCompletePopup() {
        if (popup != null) {
            popup.setVisible(false);
        }
        
        popup = new JPopupMenu();
        for (String item : history) {
            if (item.toLowerCase().contains(getText().toLowerCase()) || getText().isEmpty()) {
                JMenuItem menuItem = new JMenuItem(item);
                menuItem.addActionListener(e -> {
                    setText(item);
                    popup.setVisible(false);
                });
                popup.add(menuItem);
            }
        }
        
        if (popup.getComponentCount() > 0) {
            popup.show(this, 0, getHeight());
        }
    }
    
    private void updateAutoCompletePopup() {
        if (getText().isEmpty()) {
            if (popup != null && popup.isVisible()) {
                popup.setVisible(false);
            }
            return;
        }
        
        showAutoCompletePopup();
    }
    
    public void updateHistory(List<String> newHistory) {
        this.history = newHistory;
    }
}
