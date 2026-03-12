package UltraKibanaDownloader.components;

import javax.swing.*;
import javax.swing.text.*;
import java.awt.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Enhanced output area with colored text, timestamps, and filtering capabilities
 */
public class EnhancedOutputArea extends JTextPane {
    
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm:ss");
    private boolean showTimestamps = true;
    private boolean autoScroll = true;
    
    // Colors for different log levels
    public static final Color COLOR_INFO = Color.BLACK;
    public static final Color COLOR_SUCCESS = new Color(0, 100, 0);
    public static final Color COLOR_WARNING = new Color(255, 165, 0);
    public static final Color COLOR_ERROR = new Color(220, 20, 60);
    public static final Color COLOR_DEBUG = new Color(100, 149, 237);
    
    public EnhancedOutputArea() {
        super();
        setupStyles();
        setEditable(false);
        setBackground(new Color(250, 250, 250));
        setFont(new Font("Consolas", Font.PLAIN, 12));
    }
    
    private void setupStyles() {
        StyledDocument doc = getStyledDocument();
        
        // Create styles for different log levels
        Style defaultStyle = doc.addStyle("default", null);
        StyleConstants.setForeground(defaultStyle, COLOR_INFO);
        
        Style successStyle = doc.addStyle("success", null);
        StyleConstants.setForeground(successStyle, COLOR_SUCCESS);
        StyleConstants.setBold(successStyle, true);
        
        Style warningStyle = doc.addStyle("warning", null);
        StyleConstants.setForeground(warningStyle, COLOR_WARNING);
        StyleConstants.setBold(warningStyle, true);
        
        Style errorStyle = doc.addStyle("error", null);
        StyleConstants.setForeground(errorStyle, COLOR_ERROR);
        StyleConstants.setBold(errorStyle, true);
        
        Style debugStyle = doc.addStyle("debug", null);
        StyleConstants.setForeground(debugStyle, COLOR_DEBUG);
        StyleConstants.setItalic(debugStyle, true);
        
        Style timestampStyle = doc.addStyle("timestamp", null);
        StyleConstants.setForeground(timestampStyle, Color.GRAY);
        StyleConstants.setFontSize(timestampStyle, 10);
    }
    
    public void appendText(String text, LogLevel level) {
        SwingUtilities.invokeLater(() -> {
            try {
                StyledDocument doc = getStyledDocument();
                
                // Add timestamp if enabled
                if (showTimestamps) {
                    String timestamp = "[" + LocalDateTime.now().format(TIME_FORMAT) + "] ";
                    doc.insertString(doc.getLength(), timestamp, doc.getStyle("timestamp"));
                }
                
                // Add main text with appropriate style
                String styleName = getStyleName(level);
                doc.insertString(doc.getLength(), text, doc.getStyle(styleName));
                
                // Auto-scroll to bottom
                if (autoScroll) {
                    setCaretPosition(doc.getLength());
                }
                
            } catch (BadLocationException e) {
                System.err.println("Error appending text: " + e.getMessage());
            }
        });
    }
    
    private String getStyleName(LogLevel level) {
        switch (level) {
            case SUCCESS: return "success";
            case WARNING: return "warning";
            case ERROR: return "error";
            case DEBUG: return "debug";
            default: return "default";
        }
    }
    
    public void appendInfo(String text) {
        appendText(text, LogLevel.INFO);
    }
    
    public void appendSuccess(String text) {
        appendText(text, LogLevel.SUCCESS);
    }
    
    public void appendWarning(String text) {
        appendText(text, LogLevel.WARNING);
    }
    
    public void appendError(String text) {
        appendText(text, LogLevel.ERROR);
    }
    
    public void appendDebug(String text) {
        appendText(text, LogLevel.DEBUG);
    }
    
    public void clearOutput() {
        setText("");
    }
    
    public void setShowTimestamps(boolean showTimestamps) {
        this.showTimestamps = showTimestamps;
    }
    
    public void setAutoScroll(boolean autoScroll) {
        this.autoScroll = autoScroll;
    }
    
    public enum LogLevel {
        INFO, SUCCESS, WARNING, ERROR, DEBUG
    }
}
