const btnNuevaPista = document.getElementById("btnNuevaPista");
const formPista = document.getElementById("formPista");
const btnGuardarPista = document.getElementById("guardarPista");

// PISTAS

if (btnNuevaPista) {
  btnNuevaPista.onclick = () => {
    formPista.style.display = "block";
    document.getElementById("listaPistas").style.display = "none";
    document.getElementById("btnNuevaPista").style.display = "none";

    const btnVolver = document.getElementById("btnVolverPistas");
    if (btnVolver) btnVolver.style.display = "none";
  };
}

if (btnGuardarPista) {
  btnGuardarPista.onclick = async () => {
    try {

      const nombre = document.getElementById("nombrePista").value;
      const localidad = document.getElementById("localidadPista").value;

      const tipo = document.getElementById("tipoPista").value;
      const indoor = document.getElementById("indoor").value;
      const outdoor = document.getElementById("outdoor").value;

      const precioManana = Number(document.getElementById("precioManana").value);
      const precioTarde = Number(document.getElementById("precioTarde").value);
      const precioFestivo = Number(document.getElementById("precioFestivo").value);

      const lat = document.getElementById("lat").value;
      const lng = document.getElementById("lng").value;
      const reserva = document.getElementById("reserva").value;

      let urlImagen = "";

      const inputFotoPista = document.getElementById("inputFotoPista");

      if (inputFotoPista.files.length > 0) {
        const file = inputFotoPista.files[0];
        const ruta = "pistas/" + Date.now() + ".jpg";
        urlImagen = await subirImagen(ruta, file);
      }

      if (!urlImagen && window.pistaEditando) {
        const doc = await db.collection("pistas").doc(window.pistaEditando).get();
        const dataActual = doc.data();
        urlImagen = dataActual.imagen || "";
      }

      if (
        !nombre.trim() ||
        !localidad ||
        !tipo ||
        indoor === "" ||
        outdoor === "" ||
        isNaN(precioManana) ||
        isNaN(precioTarde) ||
        isNaN(precioFestivo) ||
        !lat ||
        !lng ||
        !reserva
      ) {
        alert("Todos los campos son obligatorios");
        return;
      }

      const nombreNorm = normalizarTexto(nombre);
      const localidadNorm = normalizarTexto(localidad);

      const snapshot = await db.collection("pistas").get();

      let existe = false;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (
          data.nombreNorm === nombreNorm &&
          data.localidadNorm === localidadNorm
        ) {
          existe = true;
        }
      });

      if (existe && !window.pistaEditando) {
        alert("Esta pista ya existe");
        return;
      }

      const datos = {
        nombre: nombre,
        nombreNorm: nombreNorm,
        localidad: localidad,
        localidadNorm: localidadNorm,
        direccion: document.getElementById("direccionPista").value,
        tipo: tipo,
        indoor: Number(indoor),
        outdoor: Number(outdoor),
        precioManana: precioManana,
        precioTarde: precioTarde,
        precioFestivo: precioFestivo,
        lat: Number(lat),
        lng: Number(lng),
        reserva: reserva,
        creadaPor: auth.currentUser.uid
      };

      if (urlImagen) {
        datos.imagen = urlImagen;
      }

      if (window.pistaEditando) {
        await db.collection("pistas").doc(window.pistaEditando).update({
          ...datos,
          verificada: true
        });
        window.pistaEditando = null;
      } else {
        await db.collection("pistas").add({
          ...datos,
          verificada: esAdmin === true
        });
      }

      cargarPistas();
      mostrar("pistas");

    } catch (error) {
      console.error("ERROR REAL:", error);
    }
  };
}

async function cargarPistas() {
  console.log("CARGANDO PISTAS");

  esAdmin = false;
const user = auth.currentUser;
  if (user) {
    const docUser = await db.collection("usuarios").doc(user.uid).get();
    if (docUser.exists && docUser.data().admin === true) {
      esAdmin = true;
    }
  }

  const lista = document.getElementById("listaPistas");
  if (!lista) return;

  if (unsubscribePistas) unsubscribePistas();

  unsubscribePistas = db.collection("pistas")
    .onSnapshot(snapshot => {

      lista.innerHTML = "";

      snapshot.forEach(doc => {
        const data = doc.data();

        const div = document.createElement("div");
        div.className = "cardPista";

        div.innerHTML =
          "<img src='" + (data.imagen || "") + "'>" +
          "<strong>" + (data.nombre || "") + "</strong><br>" +
          (data.verificada ? "<div class='verificada'>✔️ Verificada</div>" : "") +
          (data.localidad || "") + "<br>" +
          (data.tipo || "") + "<br>" +
          "Indoor: " + (data.indoor || 0) + " | Outdoor: " + (data.outdoor || 0) + "<br>" +
          (data.precioManana || 0) + "€ mañana / " +
          (data.precioTarde || 0) + "€ tarde / " +
          (data.precioFestivo || 0) + "€ finde / festivo";

        if (esAdmin) {
          div.innerHTML +=
            "<div style='margin-top:10px;'>" +
            "<button class='btnEditar' onclick=\"editarPista('" + doc.id + "')\">Editar</button>" +
            "<button class='btnEliminar' onclick=\"eliminarPista('" + doc.id + "')\">Eliminar</button>";

          if (!data.verificada) {
            div.innerHTML +=
              "<button class='btnVerificar' onclick=\"verificarPista('" + doc.id + "')\">Verificar</button>";
          }

          div.innerHTML += "</div>";
        }

        lista.appendChild(div);
      });
    });
}

async function borrarImagen(url) {
  if (!url) return;

  try {
    const ref = firebase.storage().refFromURL(url);
    await ref.delete();
  } catch (e) {
    console.log("No se pudo borrar");
  }
}

function mostrar(seccion){

  const btnFoto = document.getElementById("btnCambiarFoto");
  if (btnFoto) btnFoto.style.display = "none";

  document.getElementById("login").style.display = "none";
  document.getElementById("menu").style.display = "none";
  document.getElementById("perfilCompletar").style.display = "none";
  document.getElementById("perfil").style.display = "none";

  const perfilEditar = document.getElementById("perfilEditar");
  if (perfilEditar) perfilEditar.style.display = "none";

  document.getElementById("jugadores").style.display = "none";

  const pistas = document.getElementById("pistas");
  if (pistas) pistas.style.display = "none";

  const testNivel = document.getElementById("testNivel");
  if (testNivel) testNivel.style.display = "none";

  document.getElementById("crearPista").style.display = "none";

  document.getElementById(seccion).style.display = "block";

  if (seccion === "pistas") {
    cargarPistas();
  }
}

window.verificarPista = async function(id) {

  const user = auth.currentUser;
  if (!user) return;

  const docUser = await db.collection("usuarios").doc(user.uid).get();
  if (!docUser.exists || docUser.data().admin !== true) return;

  await db.collection("pistas").doc(id).update({
    verificada: true,
    verificadaPor: user.uid,
    fechaVerificada: firebase.firestore.FieldValue.serverTimestamp()
  });

  cargarPistas();
}