const axios = require('axios');

// Server endpoint
const SERVER_URL = 'http://172.24.212.57:3000/write';

// Simulated users and their devices
const users = Array.from({ length: 10 }, (_, i) => ({
    clientName: `user${i + 1}`,
    devices: [
        { deviceId: `air_purifier_${i + 1}_001`, location: 'Living Room' },
        { deviceId: `air_purifier_${i + 1}_002`, location: 'Bedroom' },
        { deviceId: `air_purifier_${i + 1}_003`, location: 'Kitchen' },
    ],
}));

// Function to generate random sensor data
function generateSensorData() {
    return {
        temperature: (Math.random() * (30 - 18) + 18).toFixed(1), // 18°C to 30°C
        humidity: (Math.random() * (70 - 30) + 30).toFixed(1),    // 30% to 70%
    };
}

// Function to send data to the server for all users
async function sendSensorData() {
    try {
        for (const user of users) {
            for (const device of user.devices) {
                const { temperature, humidity } = generateSensorData();
                const payload = {
                    clientName: user.clientName,
                    deviceId: device.deviceId,
                    temperature: parseFloat(temperature),
                    humidity: parseFloat(humidity),
                };

                const response = await axios.post(SERVER_URL, payload, {
                    headers: { 'Content-Type': 'application/json' },
                });

                console.log(`Sent data for ${user.clientName}/${device.deviceId}: temp=${temperature}°C, humidity=${humidity}%`);
                console.log(`Server response: ${response.data.message}`);
            }
        }
        console.log('All data sent successfully for all users');
    } catch (error) {
        console.error('Error sending data:', error.response ? error.response.data : error.message);
    }
}

// Run every 10 seconds
async function startClient() {
    console.log('Starting air purifier client simulator for 10 users...');
    await sendSensorData(); // Initial run
    setInterval(sendSensorData, 10000); // Every 10 seconds
}

startClient();