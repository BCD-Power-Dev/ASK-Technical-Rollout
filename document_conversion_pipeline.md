# SharePoint → R2 → PostgreSQL Knowledge Pipeline

## Overview

This pipeline ingests documents from the Operations Knowledge Base SharePoint library, converts and enriches content, publishes artifacts to Cloudflare R2, and loads searchable metadata into PostgreSQL.

## Core Objectives

### Functional Goals
- Download new and changed SharePoint files.
- Detect deleted files.
- Convert Office documents into searchable formats.
- Upload processed artifacts to R2.
- Load searchable metadata into PostgreSQL.
- Support delta-based processing.
- Support recovery and reconciliation.

### Operational Goals
- Avoid full-library processing whenever possible.
- Handle password-protected documents.
- Handle malformed or oversized spreadsheets.
- Prevent overlapping pipeline executions.
- Support self-healing inventory reconciliation.

# Source of Truth

## Current
SharePoint acts as the originating source.

## Target Architecture
R2 + Metadata becomes the master inventory.

# Directory Structure

## Pipeline State
C:\PipelineState
- graph_delta.txt
- changed_files.json
- deleted_items.json
- pipeline.lock

## Incoming Documents
C:\temp\incoming

## Processed Output
C:\Users\JHibbard\OneDrive - BCD Travel\Doc_Export

### assets stored
- XXX.ai.json
- XXX.md
- XXX.meta.json
- XXX.pdf

# Pipeline Stages

## Stage 1 - Graph Delta
Script: download_delta_files.ps1

Responsibilities:
- Authenticate to Graph
- Read delta token
- Request incremental changes
- Download changed files
- Download metadata
- Track deletions
- Create changed_files.json

Outputs:
- graph_delta.txt
- deleted_items.json
- changed_files.json
- *.graph.json

## Stage 2 - SharePoint Processing
Script: SharePointDocs.ps1

Processes:
- DOC
- DOCX
- XLS
- XLSX
- PDF

Outputs:
- PDF
- Markdown
- AI Metadata
- Document Metadata

# Office Conversion

## Word
Worker: Convert-OneDoc.ps1

Generates:
- PDF
- Markdown

Handling:
- PASSWORD_PROTECTED documents are skipped and logged.

## Excel
Worker: Convert-OneXlsx.ps1

Generates:
- PDF
- Markdown

Special Handling:
- PASSWORD_PROTECTED
- WORKER_FAILED
- Oversized workbooks
- PDF_ONLY (recommended future state)

## PDF
Worker: extract_pdf.py

# Metadata Artifacts

## .graph.json
Stores SharePoint metadata and lookup values.

### Example payload

```json
{
    "downloadedAt":  "2026-10-07T14:19:33.0658409-06:00",
    "sharepoint":  {
                       "webUrl":  "https://bcdglobal.sharepoint.com/sites/OperationsKB/_layouts/15/Doc.aspx?sourcedoc=%7BC7087A00-1CA9-451E-BCB6-AF057417C06A%7D\u0026file=Working%20an%20Alert%20in%20Satmetrix.docx\u0026action=default\u0026mobileredirect=true",
                       "parentPath":  "/drives/b!8FQ9KJ78o0uJKA5vkDhBM7By97T0EKVKtIg8WpocXgIqQnrhW55YQ4S4VnA0e9en/root:/BCD Global/Global Tools and Systems/Satmetrix",
                       "createdDateTime":  "2022-11-04T16:06:15Z",
                       "itemId":  "0132CTIWAAPIEMPKI4DZC3ZNVPAV2BPQDK",
                       "modifiedBy":  "Joshua Bartunek (US)",
                       "lastModifiedDateTime":  "2026-03-23T21:55:45Z",
                       "createdBy":  "Shelli Patrick (US)"
                   },
    "fields":  {
                   "process_category":  "Technology",
                   "smid":  null,
                   "vendor_type":  null,
                   "tools_and_technology":  "Satmetrix",
                   "travel_activity":  "N/A",
                   "gds":  {

                           },
                   "gcn":  null,
                   "vendor":  {

                              },
                   "audience":  null,
                   "title":  "Working an Alert in Satmetrix",
                   "country":  [
                                   "United States",
                                   "Canada"
                               ]
               }
}

```

## .meta.json
Stores processing state, timestamps, and SharePoint links.

### Example payload

```json
{
    "sharepoint":  {
                       "webUrl":  "https://bcdglobal.sharepoint.com/sites/OperationsKB/Process_And_Procedure_Document_Library/3M/3M%20Agency%20Tktg%20Instructions%20GMNA%2023-25__DL.pdf",
                       "document_id":  "GLOBALBCD-1846661861-13584538",
                       "itemId":  "0132CTIWDLGMBOBRQD7NGLHNFOXS56UJYJ"
                   },
    "ai":  {
               "docId":  "0132CTIWDLGMBOBRQD7NGLHNFOXS56UJYJ",
               "source":  "sharepoint",
               "title":  "3M Agency Tktg Instructions GMNA 23-25__DL"
           },
    "smid":  [

             ],
    "timestamps":  {
                       "sharepointModified":  "2026-03-23T21:55:55Z",
                       "generatedAt":  "2026-10-05T13:17:56.9393979-06:00"
                   },
    "processing":  {
                       "processed_at":  "2026-10-05T13:17:56.9393979-06:00",
                       "extractor_version":  "1.1"
                   },
    "travel_type_category":  [
                                 "Air"
                             ],
    "gcn":  "2250",
    "audience":  [
                     "N/A"
                 ],
    "folder":  "3M",
    "country":  [
                    "Brazil"
                ]
}

```

## .ai.json
Stores conversion results and search metadata.

### example payload

```json
{
    "conversion":  {
                       "pdf_exists":  true,
                       "md_exists":  true
                   },
    "source":  "sharepoint",
    "generatedAt":  "2026-10-05T13:17:56.9327477-06:00",
    "document_id":  "GLOBALBCD-1846661861-13584538",
    "title":  "3M Agency Tktg Instructions GMNA 23-25__DL",
    "docId":  "0132CTIWDLGMBOBRQD7NGLHNFOXS56UJYJ"
}
```

# Processing Status Values
- SUCCESS
- PASSWORD_PROTECTED
- WORKER_FAILED
- PDF_ONLY (future)

# Temp Sync
Uses robocopy with retry logic.

# Cloudflare R2
Stores:
- PDF
- MD
- META
- AI

Target master inventory.

# PostgreSQL
Primary search inventory.

Stores:
- docId
- title
- metadata
- pdf_url
- md_url
- sharepoint_url

# Delete Processing
Graph Delete → Temp Delete → R2 Delete → Postgres Delete

Goal:
SharePoint = Temp = R2 = Postgres

# Delta Processing
Graph Delta → changed_files.json → Changed-file processing

# Pipeline Locking
C:\PipelineState\pipeline.lock

# Reconciliation Strategy

## Daily Delta
Graph Delta processing.

## Periodic Reconciliation
Compare SharePoint, Temp, R2, and Postgres.

# Desired End State
SharePoint → Graph Delta → changed_files.json → SharePointDocs → Doc_Export → R2 → PostgreSQL → Search/UI

Includes:
- Password-Protected Handling
- Worker Failure Handling
- Delete Handling
- Inventory Reconciliation
- Self-Healing Rebuild Capability
