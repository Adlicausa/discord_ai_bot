// Sistema de almacenamiento de datos para el Bot de Discord con IA
const fs = require('fs').promises;
const path = require('path');

// Rutas de los directorios de datos
const DATA_DIR = path.join(__dirname, '../data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const CONVERSATIONS_DIR = path.join(DATA_DIR, 'conversations');
const CHANNELS_DIR = path.join(DATA_DIR, 'channels');

/**
 * Guarda datos en un archivo JSON
 * @param {string} directory - Directorio donde guardar el archivo
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @param {Object} data - Datos a guardar
 */
async function saveData(directory, filename, data) {
    try {
        // Asegurar que el directorio existe
        await fs.mkdir(directory, { recursive: true });
        
        const filePath = path.join(directory, `${filename}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Datos guardados en: ${filePath}`);
        return true;
    } catch (error) {
        console.error(`Error al guardar datos en ${directory}/${filename}.json:`, error);
        return false;
    }
}

/**
 * Lee datos de un archivo JSON
 * @param {string} directory - Directorio del archivo
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @returns {Object|null} - Datos leídos o null si hay error
 */
async function loadData(directory, filename) {
    try {
        const filePath = path.join(directory, `${filename}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Si el error es que el archivo no existe, esto es normal para nuevos usuarios
        if (error.code === 'ENOENT') {
            console.log(`El archivo ${filename}.json no existe en ${directory}`);
            return null;
        }
        console.error(`Error al leer datos de ${directory}/${filename}.json:`, error);
        return null;
    }
}

/**
 * Verifica si un archivo existe
 * @param {string} directory - Directorio del archivo
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @returns {Promise<boolean>} - true si existe, false si no
 */
async function fileExists(directory, filename) {
    try {
        const filePath = path.join(directory, `${filename}.json`);
        await fs.access(filePath);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Lista todos los archivos en un directorio
 * @param {string} directory - Directorio a listar
 * @returns {Promise<string[]>} - Array con nombres de archivos sin extensión
 */
async function listFiles(directory) {
    try {
        const files = await fs.readdir(directory);
        // Eliminar la extensión .json de los nombres
        return files
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''));
    } catch (error) {
        console.error(`Error al listar archivos en ${directory}:`, error);
        return [];
    }
}

// Métodos específicos para cada tipo de dato

// --- Usuarios ---
async function saveUser(userId, userData) {
    return saveData(USERS_DIR, userId, userData);
}

async function loadUser(userId) {
    return loadData(USERS_DIR, userId);
}

async function userExists(userId) {
    return fileExists(USERS_DIR, userId);
}

async function listUsers() {
    return listFiles(USERS_DIR);
}

// --- Conversaciones ---
async function saveConversation(conversationId, conversationData) {
    return saveData(CONVERSATIONS_DIR, conversationId, conversationData);
}

async function loadConversation(conversationId) {
    return loadData(CONVERSATIONS_DIR, conversationId);
}

async function listConversations() {
    return listFiles(CONVERSATIONS_DIR);
}

// --- Canales ---
async function saveChannel(channelId, channelData) {
    return saveData(CHANNELS_DIR, channelId, channelData);
}

async function loadChannel(channelId) {
    return loadData(CHANNELS_DIR, channelId);
}

async function channelExists(channelId) {
    return fileExists(CHANNELS_DIR, channelId);
}

async function listChannels() {
    return listFiles(CHANNELS_DIR);
}

module.exports = {
    saveUser,
    loadUser,
    userExists,
    listUsers,
    saveConversation,
    loadConversation,
    listConversations,
    saveChannel,
    loadChannel,
    channelExists,
    listChannels
};
