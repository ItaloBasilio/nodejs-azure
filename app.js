const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

/* ======================
   ROUTERS
====================== */
const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const authRouter = require("./routes/auth");
const chamadosRouter = require("./routes/chamados");
const clientesRouter = require("./routes/clientes");
const categoriasRouter = require("./routes/categorias");
const gruposRouter = require("./routes/grupos");

const app = express();

/* ======================
   MIDDLEWARES
====================== */
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/* ======================
   VIEW ENGINE
====================== */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

/* ======================
   ROTAS API
====================== */
app.use("/api/auth", authRouter);
app.use("/api/chamados", chamadosRouter);
app.use("/api/usuarios", usersRouter);
app.use("/api/clientes", clientesRouter);
app.use("/api/categorias", categoriasRouter);
app.use("/api/grupos", gruposRouter);

/* ======================
   ROTAS PÁGINAS
====================== */
app.use("/", indexRouter);

/* ======================
   404
====================== */
app.use(function (req, res, next) {
  next(createError(404));
});

/* ======================
   ERROR HANDLER
====================== */
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;