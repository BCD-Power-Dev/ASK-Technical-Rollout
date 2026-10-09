## Script-to-Script Dependencies

```ps1
Get-ChildItem C:\Users\JHibbard\scripts -File |
ForEach-Object {

    Write-Host ""
    Write-Host "========== $($_.Name) =========="

    Select-String `
        -Path $_.FullName `
        -Pattern '\.ps1|\.py|graph_inventory|changed_files|reconcile|loader|postgres|r2|upload' `
        -SimpleMatch `
        -ErrorAction SilentlyContinue

}
```

## Script Invocation Map

```ps1
Get-ChildItem C:\Users\JHibbard\scripts -File |
ForEach-Object {

    Select-String `
        -Path $_.FullName `
        -Pattern '\.ps1|\.py' `
        -AllMatches |
    ForEach-Object {

        [PSCustomObject]@{
            Script      = $_.Path
            Dependency  = $_.Line.Trim()
        }

    }

} |
Export-Csv `
"C:\Users\JHibbard\scripts\script_dependencies.csv" `
-NoTypeInformation
```

## All references to changed_files.json

```ps1
Select-String `
-Path C:\Users\JHibbard\scripts\* `
-Pattern "changed_files.json"
```

## All references to PipelineState

```ps1
Select-String `
-Path C:\Users\JHibbard\scripts\* `
-Pattern "PipelineState"
```

## All references to graph_inventory

```ps1
Select-String `
-Path C:\Users\JHibbard\scripts\* `
-Pattern "graph_inventory"
```

## Every Postgres Consumer

```ps1
Select-String `
-Path C:\Users\JHibbard\scripts\* `
-Pattern "psycopg2|postgres|public.documents|tool1"
```

## Every R2 Consumer

```ps1
Select-String `
-Path C:\Users\JHibbard\scripts\* `
-Pattern "aws s3|tooljet-files|cloudflarestorage"
```

## Find Legacy Candidates
Anything never referenced by another script is a candidate for archive

```ps1
Get-ChildItem C:\Users\JHibbard\scripts -File |
Select Name |
Sort Name
```

#### Compare it to (scripts never called are candidate for removal)

```ps1
Select-String `
-Path C:\Users\JHibbard\scripts\* `
-Pattern '\.ps1|\.py'
```

## Generate a Live Dependency Report

```ps1
Get-ChildItem C:\Users\JHibbard\scripts -File |
Sort Name |
ForEach-Object {
    "- $($_.Name)"
} |
Set-Content C:\Users\JHibbard\scripts\SCRIPT_INVENTORY.md
```
