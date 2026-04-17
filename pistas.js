const btnNuevaPista = document.getElementById("btnNuevaPista");
const formPista = document.getElementById("formPista");
const btnGuardarPista = document.getElementById("guardarPista");

// PISTAS


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

  if (window.unsubscribePistas) {
  window.unsubscribePistas();
}

 window.unsubscribePistas = db.collection("pistas")
    .onSnapshot(snapshot => {

      lista.innerHTML = "";

      snapshot.forEach(doc => {
        const data = doc.data();

        const div = document.createElement("div");
        div.className = "cardPista";

        div.innerHTML =
"<img src='" + (data.imagen || "") + "'>" +

"<strong>" + (data.nombre || "") + "</strong> " +
(data.verificada ? "<span class='verificada'>✔️ Verificada</span>" : "") + "<br>" +

"<div>" + (data.tipo || "") + "</div>" +

"<div>" + (data.localidad || "") +
(data.direccion ? " | " + data.direccion : "") +
"</div>" +

"<div>Indoor: " + (data.indoor || 0) + " | Outdoor: " + (data.outdoor || 0) + "</div>" +

"<div>" +
(data.precioManana || 0) + "€ mañana | " +
(data.precioTarde || 0) + "€ tarde | " +
(data.precioFestivo || 0) + "€ finde/festivo" +
"</div>";

if (data.lat && data.lng) {
  div.innerHTML +=
  "<div style='margin-top:10px;'>" +
  "<button class='btnBlue' onclick=\"abrirMapa(" + data.lat + "," + data.lng + ")\">Cómo llegar</button>" +
  "</div>";
}

        if (esAdmin) {
          div.innerHTML +=
  "<div style='margin-top:10px;'>" +
  "<button class='btnEditar' onclick=\"abrirEditarPista('" + doc.id + "')\">Editar</button>" +
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

// ===== GOOGLE MAPS - CÓMO LLEGAR =====
window.abrirMapa = function(lat, lng) {
  const url = "https://www.google.com/maps?q=" + lat + "," + lng;
  window.open(url, "_blank");
}


// ===== PISTAS - ABRIR EDITAR =====
window.abrirEditarPista = async function(id) {

  const doc = await db.collection("pistas").doc(id).get();
  const data = doc.data();

  // TEXTO
  document.getElementById("editarNombrePista").value = data.nombre || "";
  document.getElementById("editarDireccionPista").value = data.direccion || "";
  document.getElementById("editarLat").value = data.lat || "";
  document.getElementById("editarLng").value = data.lng || "";
  document.getElementById("editarReserva").value = data.reserva || "";

  // SELECTS
  document.getElementById("editarLocalidadPista").value = data.localidad || "";
  document.getElementById("editarTipoPista").value = data.tipo || "";

  document.getElementById("editarIndoor").value = data.indoor !== undefined ? data.indoor : "";
  document.getElementById("editarOutdoor").value = data.outdoor !== undefined ? data.outdoor : "";

  document.getElementById("editarPrecioManana").value = data.precioManana || "";
  document.getElementById("editarPrecioTarde").value = data.precioTarde || "";
  document.getElementById("editarPrecioFestivo").value = data.precioFestivo || "";

  window.idPistaEditando = id;

  mostrar("editarPista");
};

// ===== PISTAS - GUARDAR EDICIÓN =====
const btnActualizar = document.getElementById("btnActualizarPista");

if (btnActualizar) {
  btnActualizar.onclick = async () => {

    await db.collection("pistas").doc(window.idPistaEditando).update({

      nombre: document.getElementById("editarNombrePista").value,
      localidad: document.getElementById("editarLocalidadPista").value,
      direccion: document.getElementById("editarDireccionPista").value,
      tipo: document.getElementById("editarTipoPista").value,

      indoor: Number(document.getElementById("editarIndoor").value),
      outdoor: Number(document.getElementById("editarOutdoor").value),

      precioManana: Number(document.getElementById("editarPrecioManana").value),
      precioTarde: Number(document.getElementById("editarPrecioTarde").value),
      precioFestivo: Number(document.getElementById("editarPrecioFestivo").value),

      lat: document.getElementById("editarLat").value,
      lng: document.getElementById("editarLng").value,
      reserva: document.getElementById("editarReserva").value,

      verificada: true
    });

    window.pistasCargadas = false;
    mostrar("pistas");
  };
}