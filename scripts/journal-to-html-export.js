/*
    * Journal to HTML Export Macro
    * Exports journal entries to a clean HTML file, preserving formatting
    * while removing images and compendium links.
    * Allows selection of specific journal folders or exporting all journals.
    * Generates a Table of Contents with links to each journal entry.
    * Intended for GMs using the PF2e system on Foundry V10+.
 */

export const JOURNAL_EXPORT_MACRO_NAME = "Export Journals";
export const JOURNAL_EXPORT_MACRO_ICON = "modules/pf2e-awesome-macros-for-gms/assets/journal-to-html-export.png"

// --- UTILITY FUNCTIONS ---
/**
 * Saves content to a file.
 */
function saveDataToFile(content, contentType, fileName) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });

    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(a.href);
}

/**
 * Builds and executes the journal export based on folder selection.
 */
function runJournalExport(folderId) {
    const allJournals = Array.from(game.journal.values());
    
    // Determine which journals to export
    let journalsToExport = [];
    let exportTitle = "All Journals";

    const collectSortedJournals = (parentId) => {
        // 1. Get folders that are children of this parentId
        // (If parentId is null, we look for root folders)
        const childFolders = game.folders
            .filter(f => f.type === "JournalEntry" && f.folder?.id === parentId)
            .sort((a, b) => a.sort - b.sort);

        // 2. Get journals that are inside this specific folder
        // (If parentId is null, we look for root journals)
        const childJournals = allJournals
            .filter(j => j.folder?.id === parentId)
            .sort((a, b) => a.sort - b.sort);

        // 3. Add journals to the list (Journals usually appear before subfolders in export logic)
        journalsToExport.push(...childJournals);

        // 4. Recursively process each subfolder
        for (const folder of childFolders) {
            collectSortedJournals(folder.id);
        }
    };

    if (folderId === "all") {
        // Start at the root (null) to get everything
        collectSortedJournals(null);
        // Note: The recursive function handles filtering game.folders, 
        // but we need to ensure we grab root journals (j.folder === null) inside the function.
        // The logic `f.folder?.id === parentId` works for null if parentId is null!
    } else {
        const selectedFolder = game.folders.get(folderId);
        if (!selectedFolder) {
            ui.notifications.error("Could not find the selected folder.");
            return;
        }
        exportTitle = selectedFolder.name;

        // Start the recursion from the selected folder
        collectSortedJournals(folderId);
    }

    if (journalsToExport.length === 0) {
        ui.notifications.warn(`No journals found in the selected folder, or no files were selected.`);
        return;
    }

    // --- HTML GENERATION LOGIC ---
    let tocContent = '';
    let journalBodyContent = '';

    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${exportTitle}</title>
    <style>
        body { font-family: sans-serif; margin: 40px; }
        .toc-section { margin-bottom: 40px; border-bottom: 1px solid #ddd; padding-bottom: 20px; page-break-after: always; }
        .toc-list { list-style-type: none; padding-left: 0; }
        .toc-list li { margin-bottom: 5px; }
        .journal-entry { 
            border-bottom: 2px solid #ccc; 
            margin-bottom: 30px; 
            padding-bottom: 20px; 
            page-break-after: always; 
        }
        .journal-page { border-left: 3px solid #eee; padding-left: 15px; margin-bottom: 15px; }
        h1 { border-bottom: 1px solid #000; padding-bottom: 5px; }
        .uuid-text { font-weight: bold; color: #333; }
    </style>
</head>
<body>
    <h1>${exportTitle}</h1>`;

    for (const journal of journalsToExport) {
        const entryName = journal.name || 'Untitled Journal Entry';
        // Create a slug for the unique ID
        const entryId = journal.id; // Use the Foundry ID, which is already unique and safe

        // Build the Table of Contents link
        tocContent += `<li><a href="#${entryId}">${entryName}</a></li>`;

        // Build the Journal Body content
        journalBodyContent += `<div class="journal-entry">`;
        journalBodyContent += `<h2 id="${entryId}">${entryName}</h2>`; // Assign the ID here

        // Process Pages (V10+ structure)
        if (journal.pages && journal.pages.size > 0) {
            for (const page of journal.pages.values()) {
                
                // Only process text pages
                if (page.type === "text" && page.text && page.text.content) {
                    
                    const pageName = page.name || 'Untitled Page';
                    let pageContent = page.text.content;
                    
                    // CLEANING LOGIC 
                    let cleanedContent = pageContent.replace(/<img[^>]*>/gi, ''); // 1. Remove <img> tags
                    cleanedContent = cleanedContent.replace(/@Compendium.*?}/g, ''); // 2. Remove Compendium links
                    
                    // Keep link text from UUID tags, wrapped in a span
                    cleanedContent = cleanedContent.replace(
                        /@UUID\[.*?\{([^}]+)\}\]/g, 
                        '<span class="uuid-text">$1</span>'
                    );
                    
                    // Contingency: Remove any remaining UUID tags without link text
                    cleanedContent = cleanedContent.replace(
                        /@UUID\[.*?\]/g, 
                        ''
                    );

                    cleanedContent = cleanedContent.trim();

                    journalBodyContent += `<div class="journal-page">`;
                    journalBodyContent += `<h3>${pageName}</h3>`; // Page Title
                    journalBodyContent += cleanedContent; // Content (already HTML)
                    journalBodyContent += `</div>`;
                }
            }
        } 
        journalBodyContent += `</div>`;
    }

    // Assemble the final HTML
    htmlContent += `<div class="toc-section">
        <h2>Table of Contents</h2>
        <ul class="toc-list">
            ${tocContent}
        </ul>
    </div>`;

    htmlContent += journalBodyContent;
    htmlContent += `</body></html>`;

    // SAVE FILE 
    let fileName = `${exportTitle.toLowerCase().replace(/\s+/g, '_')}.html`;
    saveDataToFile(htmlContent, "text/html", fileName);
    ui.notifications.info(`Successfully exported ${journalsToExport.length} journal entries from ${exportTitle}!`);
}


// DIALOG POPULATION AND LAUNCH
export function openJournalExportDialog() {
    // Get all folders from the 'JournalEntry' document type
    const journalFolders = game.folders.filter(f => f.type === "JournalEntry"
        && f.depth === 1).sort((a) => a.name);

    // Build the <select> HTML dropdown options
    let folderOptions = '<option value="all">-- All Journals --</option>';
    journalFolders.forEach(folder => {
        // Add spaces for folder hierarchy if possible, otherwise just the name
        const indent = "&nbsp;&nbsp;".repeat(folder.depth || 0);
        folderOptions += `<option value="${folder.id}">${indent}${folder.name}</option>`;
    });

    // Define the dialog content
    const dialogContent = `
        <p>Select the folder you wish to export, or select "All Journals" to export everything.</p>
        <div class="form-group">
            <label>Journal Folder:</label>
            <select name="folderId" style="width:100%;">
                ${folderOptions}
            </select>
        </div>
    `;

    // Create and show the Foundry Dialog
    new Dialog({
        title: "Journal Export Selection",
        content: dialogContent,
        buttons: {
            export: {
                icon: '<i class="fas fa-file-export"></i>',
                label: "Export",
                callback: (html) => {
                    const folderId = html.find('[name="folderId"]').val();
                    runJournalExport(folderId);
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        },
        default: "export"
    }).render(true);
}