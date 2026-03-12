import logging
import csv

logger = logging.getLogger("kibanaParserLogger")

class CSVParser:
    def __init__(self, filename):
        nullsInFile = False
        if '\0' in open(filename).read():
            logger.warning("you have null bytes in your input file")
            nullsInFile = True

        with open(filename) as f:
            if nullsInFile:
                reader = csv.DictReader((line.replace('\0', '') for line in f), delimiter=",")
            else:
                reader = csv.DictReader(f, delimiter=",")

            # Detectar encabezados disponibles
            headers = reader.fieldnames
            if not headers:
                raise ValueError("El archivo CSV no tiene encabezados.")
            # Eliminar chequeo estricto de 'sd.device.src_timestamp'
            # Buscar columna de timestamp válida
            timestamp_candidates = ['sd.device.src_timestamp', '@timestamp', 'timestamp']
            timestamp_col = None
            for col in timestamp_candidates:
                if col in headers:
                    timestamp_col = col
                    break
            if not timestamp_col:
                logger.error(f"No se encontró ninguna columna de timestamp válida. Encabezados disponibles: {headers}")
                raise KeyError("No se encontró ninguna columna de timestamp válida en el archivo CSV.")
            else:
                logger.info(f"Usando la columna de timestamp: '{timestamp_col}'")

            # Leer y procesar filas normalmente
            all_rows = list(reader)
            valid_rows = []
            for idx, row in enumerate(all_rows):
                if not row[timestamp_col]:
                    logger.warning(f"Fila {idx} ignorada: no tiene valor en '{timestamp_col}'.")
                    continue
                valid_rows.append(row)
            self.rows = sorted(valid_rows, key=lambda row: row[timestamp_col], reverse=False)
            cleaned_rows = []
            for row in self.rows:
                if "@" in row[timestamp_col]:
                    row[timestamp_col] = row[timestamp_col].split("@ ")[1]
                # Para compatibilidad con el resto del código, renombrar la columna a 'sd.device.src_timestamp'
                row['sd.device.src_timestamp'] = row[timestamp_col]
                cleaned_rows.append(row)
            self.rows = cleaned_rows
    
    def getRowsFilteredIn(self, words=None):
        rowsFiltered = list()
        for row in self.rows:
            add = False
            if not words:
                add = True
            else:
                if any(val in row["log.original"] for val in words):
                    add = True
            if add:
                rowsFiltered.append(row)

        return rowsFiltered

    def getRowsFilteredOut(self, words=None):
        rowsFiltered = list()
        for row in self.rows:
            add = True
            if words:
                if any(val in row["log.original"] for val in words):
                    add = False
            if add:
                rowsFiltered.append(row)

        return rowsFiltered

    def printRowsFilteredIn(self, words=None):
        rowsFiltered = self.getRowsFilteredIn(words)
        for row in rowsFiltered:
            print("%s %.8s\t%.5s\t%s" % (row["sd.device.src_timestamp"], row["service.name"], row["log.level"], row["log.original"]))

    def printRowsFilteredOut(self, words=None):
        rowsFiltered = self.getRowsFilteredOut(words)
        for row in rowsFiltered:
            print("%s %.8s\t%.5s\t%s" % (row["sd.device.src_timestamp"], row["service.name"], row["log.level"], row["log.original"]))

    def printAll(self):
        for row in self.rows:
            print("%s %.8s\t%.5s\t%s" % (row["sd.device.src_timestamp"], row["service.name"], row["log.level"], row["log.original"]))

    # Open TFN session with id 25023 for node 41501424
    def findSessions(self):
        logger.debug("findSessions")
        sessions = list()
        for row in self.rows:
            logLine = row["log.original"]
            if "Open TFN session with id" in logLine:
                start = logLine.find("id ") + len("id ")
                end = logLine.find(" for")
                session = logLine[start:end]
                sessions.append(session)

        return sessions

    # node 2BWN7W8B assigned file path "/var/volatile/media/2BWN7W8B_796347364_3.jpeg"
    def findFilenames(self):
        logger.debug("findFilenames")
        filenames = list()
        for row in self.rows:
            logLine = row["log.original"]
            if "assigned file path" in logLine:
                start = logLine.find("media/") + len("media/")
                end = logLine.find(".jpeg")
                filename = logLine[start:end]
                filenames.append(filename)

        return filenames

if __name__ == "__main__":
    import sys
    import os
    import argparse
    logging.basicConfig(level=logging.INFO)
    parser_arg = argparse.ArgumentParser(description="CSV Log Parser")
    parser_arg.add_argument("csvfile", help="Archivo CSV de entrada")
    parser_arg.add_argument("--service", nargs="*", help="Filtrar por uno o varios nombres de servicio (service.name)")
    parser_arg.add_argument("--include", nargs="*", help="Incluir solo filas cuyo log.original contenga alguna de estas palabras")
    parser_arg.add_argument("--exclude", nargs="*", help="Excluir filas cuyo log.original contenga alguna de estas palabras")
    args = parser_arg.parse_args()

    filename = args.csvfile
    if not os.path.isfile(filename):
        print(f"Archivo no encontrado: {filename}")
        sys.exit(1)
    parser = CSVParser(filename)

    # Filtrar por uno o varios service.name si se especifica
    rows = parser.rows
    if args.service:
        rows = [row for row in rows if row.get('service.name', '') in args.service]
    # Incluir solo si log.original contiene alguna palabra
    if args.include:
        rows = [row for row in rows if any(word in row.get('log.original', '') for word in args.include)]
    # Excluir si log.original contiene alguna palabra
    if args.exclude:
        rows = [row for row in rows if not any(word in row.get('log.original', '') for word in args.exclude)]

    # Exportar a .log ordenado por timestamp
    log_filename = os.path.splitext(filename)[0] + ".log"
    with open(log_filename, "w", encoding="utf-8") as fout:
        for row in rows:
            fout.write(f"[{row['sd.device.src_timestamp']}] [{row.get('service.name','')}] [{row.get('log.level','')}] {row.get('log.original','')}\n")
    print(f"Archivo .log generado: {log_filename}")
