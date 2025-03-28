require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const { BucketsAPI, OrgsAPI } = require('@influxdata/influxdb-client-apis');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Connexion InfluxDB
console.log("Connexion InfluxDB établie");
console.log("Organisation :", process.env.INFLUXDB_ORG);
console.log("Token :", process.env.INFLUXDB_TOKEN);
console.log("URL :", process.env.INFLUXDB_URL);

// Connect to InfluxDB
const influxDB = new InfluxDB({
    url: process.env.INFLUXDB_URL,
    token: process.env.INFLUXDB_TOKEN,
});

const orgName = process.env.INFLUXDB_ORG; // This is the org name, not ID
const bucketsApi = new BucketsAPI(influxDB); // Initialize BucketsApi

const orgsApi = new OrgsAPI(influxDB); // Initialize OrgsApi

// Function to get orgID from org name
async function getOrgId(orgName) {
    const orgs = await orgsApi.getOrgs({ org: orgName });
    const org = orgs.orgs.find(o => o.name === orgName);
    if (!org) throw new Error(`Organization "${orgName}" not found`);
    return org.id;
}

// API for writing data
app.post('/write', async (req, res) => {
    try {
        console.log("Requête reçue :", req.body);

        const { clientName, deviceId, temperature, humidity } = req.body;

        if (!clientName || !deviceId || temperature === undefined || humidity === undefined) {
            return res.status(400).json({ error: 'Données manquantes' });
        }

        const bucket = `bucket_${clientName}`;
        const orgId = await getOrgId(orgName); // Fetch the orgID dynamically

        // Check if the bucket exists, if not, create it
        let bucketExists = false;
        const buckets = await bucketsApi.getBuckets({ orgID: orgId });

        for (const b of buckets.buckets) {
            if (b.name === bucket) {
                bucketExists = true;
                break;
            }
        }

        if (!bucketExists) {
            console.log(`Creating bucket: ${bucket}`);
            await bucketsApi.postBuckets({
                body: {
                    orgID: orgId, // Use the fetched orgID
                    name: bucket,
                    retentionRules: [{ type: 'expire', everySeconds: 3600 * 24 * 365 }],
                },
            });
        }

        const writeApi = influxDB.getWriteApi(orgId, bucket, 'ns');
        const point = new Point('air_purifier')
            .tag('device_id', deviceId)
            .floatField('temperature', temperature)
            .floatField('humidity', humidity);

        writeApi.writePoint(point);
        await writeApi.flush();

        res.status(200).json({ message: 'Données enregistrées' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// API for reading data
app.get('/query', async (req, res) => {
    try {
        console.log("Requête reçue :", req.query);
        const { clientName, deviceId } = req.query;

        if (!clientName || !deviceId) {
            return res.status(400).json({ error: 'Données manquantes' });
        }

        const bucket = `bucket_${clientName}`;
        const orgId = await getOrgId(orgName); // Fetch the orgID dynamically
        const queryApi = influxDB.getQueryApi(orgId);

        const fluxQuery = `
            from(bucket: "${bucket}")
            |> range(start: -1h)
            |> filter(fn: (r) => r["_measurement"] == "air_purifier" and r["device_id"] == "${deviceId}")
        `;

        const results = [];
        await queryApi.queryRows(fluxQuery, {
            next: (row, tableMeta) => {
                results.push(tableMeta.toObject(row));
            },
            error: (error) => res.status(500).json({ error: error.message }),
            complete: () => res.status(200).json(results),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(port, '172.24.212.57', () => {
    console.log(`🚀 API InfluxDB en cours d'exécution sur http://172.24.212.57:${port}`);
});