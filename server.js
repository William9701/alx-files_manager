const express = require('express');

const app = express();
app.use(express.json());

const routes = require('./routes/index');

const port = process.env.PORT || 5000;

app.use('/', routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
