// Quick Whisper Macro
// Opens a UI to quickly send a private whisper to any active user (including yourself or the GM).

export const QUICK_WHISPER_MACRO_NAME = "Quick Whisper";
export const QUICK_WHISPER_MACRO_ICON = "icons/magic/sonic/projectile-sound-rings-wave.webp";

/**
 * Helper function to handle the whisper UI and chat generation.
 */
export async function quickWhisperPlayer() {
    // Get ALL active users (Players AND GMs)
    const activeUsers = game.users.filter(u => u.active);

    if (activeUsers.length === 0) {
        ui.notifications.warn("There are no active users logged in.");
        return;
    }

    // Build the internal buttons for the users
    // Appends [GM] to Game Masters, and their Character Name if assigned
    const userButtons = activeUsers.map(user => {
        const charName = user.character ? ` (${user.character.name})` : "";
        const gmTag = user.isGM ? " <b>[GM]</b>" : "";
        return `<button type="button" class="whisper-target-btn" data-user-id="${user.id}">${user.name}${gmTag}${charName}</button>`;
    }).join("");

    // CSS and HTML for the Dialog content
    const content = `
    <style>
        .quick-whisper-dialog .user-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
            margin-bottom: 10px;
        }
        .quick-whisper-dialog .whisper-target-btn {
            border: 1px solid #7a7971;
            background: rgba(0, 0, 0, 0.05);
            border-radius: 4px;
            padding: 5px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
        }
        .quick-whisper-dialog .whisper-target-btn.selected {
            background: #4a5299; /* Matches your module's blue theme */
            color: white;
            border-color: #191813;
            box-shadow: 0 0 5px #4a5299;
        }
        .quick-whisper-dialog textarea {
            width: 100%;
            height: 100px;
            resize: none;
            padding: 5px;
            box-sizing: border-box;
            font-family: inherit;
        }
    </style>
    <div class="quick-whisper-dialog">
        <p>Select a user to whisper:</p>
        <div class="user-grid">
            ${userButtons}
        </div>
        <textarea id="whisper-message-text" placeholder="Type your secret message here..."></textarea>
    </div>
    `;

    let selectedUserId = null;

    new Dialog({
        title: "Quick Whisper",
        content: content,
        buttons: {
            send: {
                icon: '<i class="fas fa-paper-plane"></i>',
                label: "Send Whisper",
                callback: (html) => {
                    const message = html.find('#whisper-message-text').val().trim();

                    // Validation checks before sending
                    if (!selectedUserId) {
                        ui.notifications.warn("You must select a user to whisper.");
                        return;
                    }
                    if (!message) {
                        ui.notifications.warn("You cannot send an empty whisper.");
                        return;
                    }

                    // Create the chat message targeting only the selected user
                    ChatMessage.create({
                        content: message,
                        whisper: [selectedUserId]
                    });
                    ui.notifications.info("Whisper sent successfully.");
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        },
        default: "send",
        render: (html) => {
            // Add click listeners to our custom user buttons
            html.find('.whisper-target-btn').click(ev => {
                // Remove the 'selected' class from all buttons
                html.find('.whisper-target-btn').removeClass('selected');

                // Add the 'selected' class to the clicked button
                const btn = $(ev.currentTarget);
                btn.addClass('selected');

                // Store the associated Foundry User ID
                selectedUserId = btn.data('user-id');

                // QoL: Automatically focus the text area
                html.find('#whisper-message-text').focus();
            });
        }
    }, {
        width: 420,
        classes: ["dialog", "quick-whisper-dialog"]
    }).render(true);
}