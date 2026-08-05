import app from "./app";

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});