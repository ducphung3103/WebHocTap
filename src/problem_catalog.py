"""Read-only problem catalog helpers. Google Sheets is authoritative."""


def read_problem_rows(worksheet):
    """Read displayed values and actual rich-text/HYPERLINK targets together."""
    title = worksheet.title.replace("'", "''")
    metadata = worksheet.spreadsheet.fetch_sheet_metadata(params={
        "ranges": f"'{title}'!A:H",
        "includeGridData": "true",
        "fields": "sheets(data(startRow,rowData(values(formattedValue,hyperlink,textFormatRuns))))",
    })
    rows = []
    for sheet in metadata.get("sheets", []):
        for block in sheet.get("data", []):
            offset = block.get("startRow", 0)
            for index, row in enumerate(block.get("rowData", []), offset):
                while len(rows) <= index:
                    rows.append([])
                cells = row.get("values", [])
                values = [cell.get("formattedValue", "") for cell in cells]
                if len(cells) > 1:
                    link_cell = cells[1]
                    targets = {run.get("format", {}).get("link", {}).get("uri")
                               for run in link_cell.get("textFormatRuns", [])}
                    targets.discard(None)
                    if len(targets) > 1:
                        raise ValueError(f"Multiple problem links in row {index + 1}")
                    target = link_cell.get("hyperlink") or next(iter(targets), None)
                    if target:
                        values[1] = target
                rows[index] = values
    return rows


def compare_catalog(rows, problems):
    """Compare both directions by exact ID; never infer or write a Sheet row."""
    sheet = {}
    for number, row in enumerate(rows[1:], 2):
        if not row or not str(row[0]).strip():
            continue
        if len(row) < 3 or not str(row[2]).strip():
            raise ValueError(f"Missing problem name in Sheet row {number}")
        pid = str(row[0]).strip()
        if pid in sheet:
            raise ValueError(f"Duplicate Sheet problem ID: {pid}")
        sheet[pid] = {"id": pid, "row": number, "name": row[2].strip(), "url": row[1].strip()}
    local = {p["id"]: p for p in problems}
    if len(local) != len(problems):
        raise ValueError("Duplicate website problem IDs")
    differences = []
    for pid in sheet.keys() & local.keys():
        changes = {key: {"web": local[pid].get(key, ""), "sheet": sheet[pid][key]}
                   for key in ("name", "url") if local[pid].get(key, "") != sheet[pid][key]}
        if changes:
            differences.append({"id": pid, "row": sheet[pid]["row"], "changes": changes})
    return {
        "sheet_count": len(sheet), "web_count": len(local),
        "differences": sorted(differences, key=lambda p: p["row"]),
        "sheet_only": [p for pid, p in sheet.items() if pid not in local],
        "web_only": [{key: p.get(key, "") for key in ("id", "name", "url")}
                     for pid, p in local.items() if pid not in sheet],
    }
