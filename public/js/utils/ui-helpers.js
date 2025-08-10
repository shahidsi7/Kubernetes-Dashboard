// public/js/utils/ui-helpers.js
// This file contains common UI helper functions used across the frontend,
// such as displaying messages, showing confirmation modals, and managing
// dynamic input fields.

// Reference to the message container (assuming it exists in the HTML)
const messageContainer = document.getElementById('messageContainer');
// References to confirmation modal elements (assuming they exist in the HTML)
const confirmationModal = document.getElementById('confirmationModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmActionBtn = document.getElementById('confirmActionBtn');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');

// Global variable to store the callback for the confirmation modal
let confirmCallback = null;

/**
 * Displays a message in a sliding toast notification.
 * This function creates a new message box element, adds it to the message container,
 * applies styling based on whether it's an error or success, and sets a timeout
 * for automatic removal.
 * @param {string} message - The message content to display.
 * @param {boolean} [isError=false] - True if it's an error message, false for success.
 */
export function showMessage(message, isError = false) {
    const messageBox = document.createElement('div');
    messageBox.classList.add('message-box');
    messageBox.classList.add(isError ? 'error' : 'success');
    messageBox.innerHTML = `
        <span>${message}</span>
        <button class="close-btn" onclick="this.parentElement.remove()">×</button>
    `;
    // Append the new message box to the container
    messageContainer.appendChild(messageBox);

    // Automatically remove the message after 5 seconds
    setTimeout(() => {
        if (messageBox.parentElement) {
            messageBox.remove();
        }
    }, 5000);
}

/**
 * Shows a custom confirmation modal to the user.
 * This modal provides a message and two buttons (Confirm/Cancel).
 * A callback function is executed based on the user's choice.
 * @param {string} message - The message to display in the modal.
 * @param {Function} callback - The function to execute when the user confirms (true) or cancels (false).
 */
export function showConfirmModal(message, callback) {
    confirmMessage.innerHTML = message; // Set the message in the modal
    confirmationModal.classList.remove('hidden'); // Show the modal by removing 'hidden' class
    confirmCallback = callback; // Store the provided callback function

    // Event listener for the 'Confirm' button
    confirmActionBtn.onclick = () => {
        confirmationModal.classList.add('hidden'); // Hide the modal
        if (confirmCallback) {
            confirmCallback(true); // Execute the stored callback with 'true' (confirmed)
            confirmCallback = null; // Clear the callback to prevent multiple calls
        }
    };

    // Event listener for the 'Cancel' button
    cancelConfirmBtn.onclick = () => {
        confirmationModal.classList.add('hidden'); // Hide the modal
        if (confirmCallback) {
            confirmCallback(false); // Execute the stored callback with 'false' (cancelled)
            confirmCallback = null; // Clear the callback
        }
    };
}

/**
 * Adds a pair of input fields (key-value) dynamically to a specified container.
 * This is useful for forms that require multiple arbitrary key-value pairs,
 * such as environment variables, labels, or parameters.
 * @param {HTMLElement} container - The DOM element to which the input fields will be appended.
 * @param {string} type - A string used for the 'name' attribute of the inputs (e.g., 'env', 'label').
 * @param {string} placeholderPrefix - A prefix for the input field placeholders (e.g., 'Environment Variable', 'Label').
 * @param {string} [initialKey=''] - Optional initial value for the key input.
 * @param {string} [initialValue=''] - Optional initial value for the value input.
 */
export function addDynamicInputField(container, type, placeholderPrefix, initialKey = '', initialValue = '') {
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'flex space-x-2 items-center'; // Tailwind classes for layout
    wrapperDiv.innerHTML = `
        <input type="text" name="${type}Key" placeholder="${placeholderPrefix} Key" value="${initialKey}"
               class="flex-1 p-2 border border-gray-300 rounded-md text-sm"/>
        <input type="text" name="${type}Value" placeholder="${placeholderPrefix} Value" value="${initialValue}"
               class="flex-1 p-2 border border-gray-300 rounded-md text-sm"/>
        <button type="button" class="remove-field-btn bg-red-500 hover:bg-red-600 text-white p-1 rounded-md text-sm">Remove</button>
    `;
    // Attach event listener to the 'Remove' button to remove its parent wrapperDiv
    wrapperDiv.querySelector('.remove-field-btn').addEventListener('click', () => wrapperDiv.remove());
    container.appendChild(wrapperDiv); // Append the new input field pair to the container
}

/**
 * Generates HTML for a skeleton loader.
 * Useful for displaying a loading state while data is being fetched.
 * @param {'rect'|'text'} [type='rect'] - The type of skeleton loader ('rect' for a block, 'text' for a line of text).
 * @param {number} [count=3] - The number of skeleton loader elements to generate.
 * @returns {string} HTML string for the skeleton loaders.
 */
export function getSkeletonLoader(type = 'rect', count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        if (type === 'rect') {
            html += '<div class="skeleton skeleton-rect"></div>';
        } else {
            html += '<div class="skeleton skeleton-text"></div>';
        }
    }
    return html;
}
