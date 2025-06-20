const express = require("express");
const cors = require("cors");
const app = express();
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY , 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

// middle war
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.a0ni9sf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const verifyTokenEmail = (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};
const verifyEmail = (email , next) =>{
  if(email !== req.decoded.email){
    return res.send(403).send({message : 'forbidden access'});
  }
}
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const jobsCollection = client.db("careerCodeDB").collection("jobs");
    const applicationsCollection = client
      .db("careerCodeDB")
      .collection("applicatins");

    // jobs api
    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });
    app.get("/myPostedJobs",verifyFirebaseToken , verifyTokenEmail, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.hr_email = email;
      }
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });
    app.post("/jobs", async (req, res) => {
      const data = req.body;
      const result = await jobsCollection.insertOne(data);
      res.send(result);
    });

    //application post
    app.post("/application", async (req, res) => {
      const application = req.body;
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    // application get
    app.get(
      "/application",
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const email = req.query.email;
        const query = { applicant: email };
        const result = await applicationsCollection.find(query).toArray();

        // bad way
        for (const application of result) {
          const jobId = application.jobId;
          const jobQuery = { _id: new ObjectId(jobId) };
          const job = await jobsCollection.findOne(jobQuery);
          application.company = job.company;
          application.title = job.title;
          application.category = job.category;
          application.company_logo = job.company_logo;
        }
        res.send(result);
      }
    );

    // get applications for job
    app.get("/applications/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { jobId: id };
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Career code cooking");
});

app.listen(port, () => {
  console.log(`Career code running on port : ${port}`);
});
