require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("API Auto École fonctionne !");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));

const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

const courseRoutes = require("./routes/courses");
app.use("/courses", courseRoutes);
