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

    if (folderId === "all") {
        journalsToExport = allJournals;
    } else {
        const selectedFolder = game.folders.get(folderId);
        if (!selectedFolder) {
            ui.notifications.error("Could not find the selected folder.");
            return;
        }

        // Create a set of folder IDs including the selected one and all its descendants
        const descendantFolderIds = new Set(selectedFolder.tree.map(f => f.id));
        descendantFolderIds.add(folderId);

        // Filter journals: keep if the journal's folder ID is in the set of descendant IDs
        journalsToExport = allJournals.filter(j => j.folder && descendantFolderIds.has(j.folder.id));

        exportTitle = selectedFolder.name;
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

        // 1a. Build the Table of Contents link
        tocContent += `<li><a href="#${entryId}">${entryName}</a></li>`;

        // 1b. Build the Journal Body content
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
                    
                    // 3. Keep link text from UUID tags, wrapped in a span
                    cleanedContent = cleanedContent.replace(
                        /@UUID\[.*?\{([^}]+)\}\]/g, 
                        '<span class="uuid-text">$1</span>'
                    );
                    
                    // 4. Contingency: Remove any remaining UUID tags without link text
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

    // STEP 2: Assemble the final HTML
    htmlContent += `<div class="toc-section">
        <h2>Table of Contents</h2>
        <ul class="toc-list">
            ${tocContent}
        </ul>
    </div>`;

    htmlContent += journalBodyContent;
    htmlContent += `</body></html>`;

    // --- SAVE FILE ---
    let fileName = `${exportTitle.toLowerCase().replace(/\s+/g, '_')}.html`;
    saveDataToFile(htmlContent, "text/html", fileName);
    ui.notifications.info(`Successfully exported ${journalsToExport.length} journal entries from ${exportTitle}!`);
}


// --- DIALOG POPULATION AND LAUNCH ---
export function openJournalExportDialog() {
    // 1. Get all folders from the 'JournalEntry' document type
    const journalFolders = game.folders.filter(f => f.type === "JournalEntry");

    // 2. Build the <select> HTML dropdown options
    let folderOptions = '<option value="all">-- All Journals --</option>';
    journalFolders.forEach(folder => {
        // Add spaces for folder hierarchy if possible, otherwise just the name
        const indent = "&nbsp;&nbsp;".repeat(folder.depth || 0);
        folderOptions += `<option value="${folder.id}">${indent}${folder.name}</option>`;
    });

    // 3. Define the dialog content
    const dialogContent = `
        <p>Select the folder you wish to export, or select "All Journals" to export everything.</p>
        <div class="form-group">
            <label>Journal Folder:</label>
            <select name="folderId" style="width:100%;">
                ${folderOptions}
            </select>
        </div>
    `;

    // 4. Create and show the Foundry Dialog
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