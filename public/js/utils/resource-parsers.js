// public/js/utils/resource-parsers.js
// This file provides utility functions for parsing and normalizing Kubernetes
// resource quantity strings (CPU and Memory) from user input.

/**
 * Parses and normalizes a resource value string (CPU or Memory) to a Kubernetes-compatible format.
 * This function is designed to take user input and ensure it conforms to the expected
 * Kubernetes quantity format (e.g., "100m" for CPU, "64Mi" for Memory).
 *
 * - For CPU:
 * - If it ends with 'm' (millicores), it's returned as is (e.g., "100m").
 * - If it's a decimal number (e.g., "0.5"), it's converted to millicores (e.g., "500m").
 * - If it's a whole number, it's treated as cores and returned as is (e.g., "1" for 1 core).
 *
 * - For Memory:
 * - If it has a recognized Kubernetes unit (e.g., Mi, Gi, M, G), it's returned as is.
 * - If it's a number without a unit, "Mi" (mebibytes) is appended by default.
 *
 * @param {string} value - The raw input string from the user (e.g., "100m", "0.5", "64Mi", "1Gi", "100").
 * @param {'cpu'|'memory'} type - The type of resource ('cpu' or 'memory').
 * @returns {string|undefined} The normalized resource string (e.g., "500m", "128Mi") or `undefined`
 * if the input is empty, invalid, or represents a zero quantity.
 */
export function parseResourceValue(value, type) {
    const trimmedValue = value.trim();

    // Treat empty or zero values as undefined to omit them from YAML manifests
    if (trimmedValue === '' || trimmedValue === '0' || trimmedValue === '0m' || trimmedValue === '0Mi' || trimmedValue === '0Gi') {
        return undefined;
    }

    if (type === 'cpu') {
        // If it already has 'm' suffix, return as is
        if (trimmedValue.endsWith('m')) {
            // Ensure the part before 'm' is a valid number
            const numPart = trimmedValue.slice(0, -1);
            if (!isNaN(parseFloat(numPart))) {
                return trimmedValue;
            }
        }
        // If it's a number (integer or float) without 'm' suffix
        if (/^\d+(\.\d+)?$/.test(trimmedValue)) {
            const floatValue = parseFloat(trimmedValue);
            // If it's a float, convert to millicores
            if (trimmedValue.includes('.')) {
                return `${Math.round(floatValue * 1000)}m`;
            }
            // If it's a whole number, assume it's cores.
            // User must explicitly use 'm' for millicores if they intend a whole number as millicores (e.g., "500m").
            return trimmedValue;
        }
        // For any other format, return undefined
        return undefined;
    } else if (type === 'memory') {
        // Check if it's a number without any common memory suffixes
        if (/^\d+$/.test(trimmedValue)) {
            return `${trimmedValue}Mi`; // Default to MiB
        }
        // Check for common Kubernetes memory units (binary and decimal)
        const memoryUnits = ['Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'E', 'P', 'T', 'G', 'M', 'K'];
        // Regex to match a number followed by one of the units
        const unitRegex = new RegExp(`^\\d+(\\.\\d+)?(${memoryUnits.join('|')})$`);
        if (unitRegex.test(trimmedValue)) {
            return trimmedValue;
        }
        // For any other format, return undefined
        return undefined;
    }
    return undefined;
}

/**
 * Converts a Kubernetes CPU quantity string (e.g., "100m", "0.5", "1") to millicores.
 * This is primarily for internal calculations or display, not for manifest generation.
 * @param {string} cpuString - The CPU quantity string.
 * @returns {number} The CPU in millicores, or 0 if invalid.
 */
export function parseCpuQuantity(cpuString) {
    if (!cpuString) return 0;
    cpuString = String(cpuString).trim();
    if (cpuString.endsWith('m')) {
        return parseFloat(cpuString.slice(0, -1));
    } else {
        return parseFloat(cpuString) * 1000; // Convert cores to millicores
    }
}

/**
 * Converts a Kubernetes memory quantity string (e.g., "64Mi", "1Gi", "100K") to MiB.
 * This is primarily for internal calculations or display, not for manifest generation.
 * Handles both binary (Ki, Mi, Gi) and decimal (K, M, G) units.
 * @param {string} memoryString - The memory quantity string.
 * @returns {number} The memory in MiB, or 0 if invalid.
 */
export function parseMemoryQuantity(memoryString) {
    if (!memoryString) return 0;
    memoryString = String(memoryString).trim();
    const value = parseFloat(memoryString);

    if (memoryString.endsWith('Ki')) {
        return value / 1024;
    } else if (memoryString.endsWith('Mi')) {
        return value;
    } else if (memoryString.endsWith('Gi')) {
        return value * 1024;
    } else if (memoryString.endsWith('Ti')) {
        return value * 1024 * 1024;
    } else if (memoryString.endsWith('Pi')) {
        return value * 1024 * 1024 * 1024;
    } else if (memoryString.endsWith('E')) { // Exabytes (decimal)
        return value * Math.pow(1000, 6) / (1024 * 1024);
    } else if (memoryString.endsWith('P')) { // Petabytes (decimal)
        return value * Math.pow(1000, 5) / (1024 * 1024);
    } else if (memoryString.endsWith('T')) { // Terabytes (decimal)
        return value * Math.pow(1000, 4) / (1024 * 1024);
    } else if (memoryString.endsWith('G')) { // Gigabytes (decimal)
        return value * Math.pow(1000, 3) / (1024 * 1024);
    } else if (memoryString.endsWith('M')) { // Megabytes (decimal)
        return value * Math.pow(1000, 2) / (1024 * 1024);
    } else if (memoryString.endsWith('K')) { // Kilobytes (decimal)
        return value * 1000 / 1024;
    } else {
        // Assume value is in bytes if no unit, convert to MiB
        return value / (1024 * 1024);
    }
}
