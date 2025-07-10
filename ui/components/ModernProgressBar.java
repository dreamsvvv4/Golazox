package ui.components;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

/**
 * Modern animated progress bar with gradient and pulsing effect
 */
public class ModernProgressBar extends JComponent {
    
    private int progress = 0;
    private int maxProgress = 100;
    private boolean indeterminate = false;
    private Timer animationTimer;
    private int animationFrame = 0;
    private String text = "";
    
    // Colors
    private Color backgroundColor = new Color(240, 240, 240);
    private Color progressColor = new Color(25, 118, 210);
    private Color textColor = new Color(33, 33, 33);
    
    public ModernProgressBar() {
        setPreferredSize(new Dimension(300, 30));
        setOpaque(false);
        setupAnimation();
    }
    
    private void setupAnimation() {
        animationTimer = new Timer(50, new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (indeterminate) {
                    animationFrame = (animationFrame + 1) % 100;
                    repaint();
                }
            }
        });
    }
    
    @Override
    protected void paintComponent(Graphics g) {
        Graphics2D g2 = (Graphics2D) g.create();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        int width = getWidth();
        int height = getHeight();
        
        // Paint background
        g2.setColor(backgroundColor);
        g2.fillRoundRect(0, 0, width, height, height, height);
        
        // Paint progress
        if (indeterminate) {
            paintIndeterminateProgress(g2, width, height);
        } else {
            paintDeterminateProgress(g2, width, height);
        }
        
        // Paint text
        if (!text.isEmpty()) {
            paintText(g2, width, height);
        }
        
        g2.dispose();
    }
    
    private void paintDeterminateProgress(Graphics2D g2, int width, int height) {
        int progressWidth = (int) ((double) progress / maxProgress * width);
        
        if (progressWidth > 0) {
            // Create gradient
            GradientPaint gradient = new GradientPaint(
                0, 0, progressColor,
                0, height, progressColor.darker()
            );
            g2.setPaint(gradient);
            g2.fillRoundRect(0, 0, progressWidth, height, height, height);
            
            // Add highlight
            g2.setColor(new Color(255, 255, 255, 80));
            g2.fillRoundRect(0, 0, progressWidth, height / 2, height / 2, height / 2);
        }
    }
    
    private void paintIndeterminateProgress(Graphics2D g2, int width, int height) {
        int barWidth = width / 3;
        int x = (int) (Math.sin(animationFrame * 0.1) * (width - barWidth) / 2 + (width - barWidth) / 2);
        
        // Create gradient
        GradientPaint gradient = new GradientPaint(
            x, 0, new Color(progressColor.getRed(), progressColor.getGreen(), progressColor.getBlue(), 0),
            x + barWidth / 2, 0, progressColor,
            true
        );
        g2.setPaint(gradient);
        g2.fillRoundRect(x, 0, barWidth, height, height, height);
    }
    
    private void paintText(Graphics2D g2, int width, int height) {
        g2.setColor(textColor);
        g2.setFont(new Font("Segoe UI", Font.BOLD, 12));
        FontMetrics fm = g2.getFontMetrics();
        
        int textWidth = fm.stringWidth(text);
        int textHeight = fm.getHeight();
        
        int x = (width - textWidth) / 2;
        int y = (height + textHeight / 2) / 2;
        
        g2.drawString(text, x, y);
    }
    
    public void setProgress(int progress) {
        this.progress = Math.max(0, Math.min(maxProgress, progress));
        repaint();
    }
    
    public int getProgress() {
        return progress;
    }
    
    public void setMaxProgress(int maxProgress) {
        this.maxProgress = maxProgress;
        repaint();
    }
    
    public void setIndeterminate(boolean indeterminate) {
        this.indeterminate = indeterminate;
        if (indeterminate) {
            animationTimer.start();
        } else {
            animationTimer.stop();
        }
        repaint();
    }
    
    public boolean isIndeterminate() {
        return indeterminate;
    }
    
    public void setText(String text) {
        this.text = text;
        repaint();
    }
    
    public String getText() {
        return text;
    }
    
    public void setProgressColor(Color color) {
        this.progressColor = color;
        repaint();
    }
    
    public void setBackgroundColor(Color color) {
        this.backgroundColor = color;
        repaint();
    }
}
