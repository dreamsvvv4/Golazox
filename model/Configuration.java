package model;

/**
 * Configuration model class to hold application settings
 */
public class Configuration {
    private String date;
    private String logs;
    private String kibanaType;
    private String selectedConfig;
    private String traces;
    private String country;
    private String excludeKeywords;
    private String includeKeywords;
    private String idType;
    private String idValue;
    private String custom;
    
    // Constructor
    public Configuration() {
        this.date = "2025-05-27 00:00:00";
        this.logs = "logs/";
        this.kibanaType = "-n aws";
        this.selectedConfig = "confForensic";
        this.traces = "30"; // Default to 30 minutes for focused search
        this.country = "ES";
        this.excludeKeywords = "";
        this.includeKeywords = "";
        this.idType = "installationId";
        this.idValue = "";
        this.custom = "";
    }
    
    // Getters and Setters
    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
    
    public String getLogs() { return logs; }
    public void setLogs(String logs) { this.logs = logs; }
    
    public String getKibanaType() { return kibanaType; }
    public void setKibanaType(String kibanaType) { this.kibanaType = kibanaType; }
    
    public String getSelectedConfig() { return selectedConfig; }
    public void setSelectedConfig(String selectedConfig) { this.selectedConfig = selectedConfig; }
    
    public String getTraces() { return traces; }
    public void setTraces(String traces) { this.traces = traces; }
    
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    
    public String getExcludeKeywords() { return excludeKeywords; }
    public void setExcludeKeywords(String excludeKeywords) { this.excludeKeywords = excludeKeywords; }
    
    public String getIncludeKeywords() { return includeKeywords; }
    public void setIncludeKeywords(String includeKeywords) { this.includeKeywords = includeKeywords; }
    
    public String getIdType() { return idType; }
    public void setIdType(String idType) { this.idType = idType; }
    
    public String getIdValue() { return idValue; }
    public void setIdValue(String idValue) { this.idValue = idValue; }
    
    public String getCustom() { return custom; }
    public void setCustom(String custom) { this.custom = custom; }
    
    // Validation methods
    public boolean isValid() {
        return !date.isEmpty() && !idValue.isEmpty() && !logs.isEmpty() && !traces.isEmpty();
    }
    
    public String getValidationError() {
        if (date.isEmpty()) return "Date field is empty.";
        if (idValue.isEmpty()) return "ID field is empty.";
        if (logs.isEmpty()) return "Logs field is empty.";
        if (traces.isEmpty()) return "Nº of traces field is empty.";
        return "";
    }
}
