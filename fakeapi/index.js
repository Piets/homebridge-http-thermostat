const express = require('express');
const app = express();
const port = 3210;

let temperature = 21.5;

app.use(express.json());

app.get('/', (req, res) => {
	res.send(JSON.stringify({temperature: temperature}));
});

app.post('/', (req, res) => {
	temperature = req.body.temperature;
	console.log(`Set Temperature to ${temperature}`);
	res.send(JSON.stringify({temperature: temperature}));
});

app.listen(port, () => {
	console.log(`Listening on port ${port}`);
});
