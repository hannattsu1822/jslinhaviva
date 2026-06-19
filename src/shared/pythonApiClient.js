const axios = require('axios');
const path = require('path');

// Carrega .env explicitamente
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const PYTHON_API_BASE = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
const PYTHON_API_KEY = process.env.PYTHON_API_KEY || 'EbOSEZos8k4yTesszu_fYKmKlLZoWZ6-01XOGTtKue0';

console.log(`[PythonAPI] Configurado: ${PYTHON_API_BASE} | Key: ${PYTHON_API_KEY ? '***definida***' : '❌ VAZIA'}`);

const apiClient = axios.create({
    baseURL: PYTHON_API_BASE,
    timeout: 10000,
    headers: { 'X-API-Key': PYTHON_API_KEY }
});

class PythonApiClient {

    async getLogboxReadings(serialNumber, limit = 300) {
        try {
            const response = await apiClient.get(`/api/logbox/${serialNumber}/readings`, {
                params: { limit }
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`[PythonAPI] Erro leituras logbox ${serialNumber}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async getLogboxStatus(serialNumber) {
        try {
            const response = await apiClient.get(`/api/logbox/${serialNumber}/status`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`[PythonAPI] Erro status logbox ${serialNumber}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async getLogboxStats(serialNumber) {
        try {
            const response = await apiClient.get(`/api/logbox/${serialNumber}/stats`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`[PythonAPI] Erro stats logbox ${serialNumber}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async getReleReadings(deviceId, limit = 100) {
        try {
            const response = await apiClient.get(`/api/rele/${deviceId}/readings`, {
                params: { limit }
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`[PythonAPI] Erro leituras relé ${deviceId}:`, error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new PythonApiClient();
