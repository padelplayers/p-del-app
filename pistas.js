const btnNuevaPista = document.getElementById("btnNuevaPista");
const btnGuardarPista = document.getElementById("guardarPista");

window.pistaUnicaDesdePartida = window.pistaUnicaDesdePartida || null;
window.pistaEditando = window.pistaEditando || null;
window.modoCrearPista = false;
window.modoEditarPista = false;

function limpiarFormularioPistaNueva() {
  const formulario = document.getElementById("formPista");
  if (formulario) {
    formulario.querySelectorAll("input, select, textarea").forEach(function(campo) {
      if (campo.type === "checkbox" || campo.type === "radio") campo.checked = false;
      else campo.value = "";
    });

    formulario.querySelectorAll("#previewFotoPista, #previewImagenPista, [data-preview-pista]").forEach(function(preview) {
      preview.removeAttribute("src");
      preview.style.display = "none";
    });
  }

  window.pistaEditando = null;
  window.modoCrearPista = true;
  window.modoEditarPista = false;
}

window.abrirNuevaPista = function() {
  if (window.modoSeleccionPista) return;
  limpiarFormularioPistaNueva();
  mostrar("crearPista");
};

function incrementarPistasCreadasLogro(uid) {
  if (!uid) return Promise.resolve(false);

  return db.collection("usuarios").doc(uid).set({
    clasificacion: {
      pistasCreadas: firebase.firestore.FieldValue.increment(1)
    }
  }, { merge: true });
}

window.recalcularPistasCreadasUsuarioActual = async function() {
  const user = auth.currentUser;
  if (!user) return 0;

  const snapshot = await db.collection("pistas")
    .where("creadaPor", "==", user.uid)
    .get();

  await db.collection("usuarios").doc(user.uid).set({
    clasificacion: {
      pistasCreadas: snapshot.size
    }
  }, { merge: true });

  return snapshot.size;
};

function resetScrollPistas() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  setTimeout(function() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 50);

  setTimeout(function() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 250);
}

if (btnGuardarPista) {
  btnGuardarPista.onclick = async (event) => {
    const estadoBoton = bloquearBotonAccion(event, "Creando...");
    if (estadoBoton.bloqueado) return;
    try {
      const user = auth.currentUser;
      if (!user) {
        alert("Debes iniciar sesión para crear una pista.");
        return;
      }

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
      const direccion = document.getElementById("direccionPista").value;
      const nota = document.getElementById("notaPista").value.trim();
      const inputFotoPista = document.getElementById("inputFotoPista");
      const archivoImagenPista = inputFotoPista && inputFotoPista.files.length > 0 ? inputFotoPista.files[0] : null;

      if (!archivoImagenPista) {
        alert("La foto de la pista es obligatoria");
        return;
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
      const direccionNorm = normalizarTexto(direccion);
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const margenCoordenadas = 0.00001;
      const snapshot = await db.collection("pistas").get();
      let existe = false;
      let mensajeDuplicado = "Esta pista ya existe";

      snapshot.forEach(doc => {
        const data = doc.data();
        const mismaLocalidad = normalizarTexto(data.localidad || "") === localidadNorm;
        const mismaDireccion = normalizarTexto(data.direccion || "") === direccionNorm;
        const latExistente = Number(data.lat);
        const lngExistente = Number(data.lng);
        const hayCoordenadas = !isNaN(latNum) && !isNaN(lngNum) && !isNaN(latExistente) && !isNaN(lngExistente);
        const mismasCoordenadas = hayCoordenadas && (
          Math.abs(latExistente - latNum) <= margenCoordenadas &&
          Math.abs(lngExistente - lngNum) <= margenCoordenadas
        );
        const duplicadaPorDireccion = mismaLocalidad && mismaDireccion;
        const duplicadaPorCoordenadas = mismasCoordenadas;

        if (duplicadaPorDireccion || duplicadaPorCoordenadas) {
          existe = true;
          if (duplicadaPorDireccion && duplicadaPorCoordenadas) {
            mensajeDuplicado = "Ya existe una pista con la misma dirección y ubicación.";
          } else if (duplicadaPorDireccion) {
            mensajeDuplicado = "Ya existe una pista con la misma localidad y dirección.";
          } else if (duplicadaPorCoordenadas) {
            mensajeDuplicado = "Ya existe una pista con las mismas coordenadas. Comprueba la ubicación seleccionada.";
          }
        }
      });

      if (existe) {
        alert(mensajeDuplicado);
        return;
      }

      if (nota.length > 120) {
        alert("La nota no puede superar los 120 caracteres");
        return;
      }

      const fpCrear = document.getElementById("formaPago");
      const formaPago = fpCrear ? fpCrear.value : "";

      const datos = {
        nombre: nombre,
        nombreNorm: nombreNorm,
        localidad: localidad,
        localidadNorm: localidadNorm,
        direccion: direccion,
        tipo: tipo,
        indoor: Number(indoor),
        outdoor: Number(outdoor),
        precioManana: precioManana,
        precioTarde: precioTarde,
        precioFestivo: precioFestivo,
        lat: Number(lat),
        lng: Number(lng),
        reserva: reserva,
        nota: nota,
        formaPago: formaPago,
        creadaPor: user.uid
      };

      if (archivoImagenPista) {
        const ruta = "pistas/" + user.uid + "/pista_" + Date.now() + ".jpg";
        datos.imagen = await subirImagen(
          ruta,
          archivoImagenPista,
          "pista-creacion"
        );
      }

      try {
        await db.collection("pistas").add({
          ...datos,
          verificada: esAdmin === true
        });
      } catch (error) {
        await borrarImagenStoragePistaSiProcede(datos.imagen || "");
        throw error;
      }
      await incrementarPistasCreadasLogro(user.uid);

      limpiarFormularioPistaNueva();
      window.modoCrearPista = false;
      cargarPistas();
      mostrar("pistas");
    } catch (error) {
      console.error("No se pudo guardar la pista:", error && error.code ? error.code : "error");
      alert(error && error.message ? error.message : "No se pudo guardar la pista.");
    } finally {
      restaurarBotonAccion(estadoBoton);
    }
  };
}

function crearTextoPista(texto, tag) {
  const el = document.createElement(tag || "div");
  el.textContent = texto;
  return el;
}

function crearBotonPista(texto, clase, onClick) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = clase;
  boton.textContent = texto;
  boton.onclick = function(event) { return onClick(event, boton); };
  return boton;
}

function normalizarTextoPista(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function pistaCoincideConModoUnico(doc, data, modo) {
  if (!modo) return true;
  if (modo.pistaId) return doc.id === modo.pistaId;

  const nombreModo = normalizarTextoPista(modo.nombre);
  const localidadModo = normalizarTextoPista(modo.localidad);
  if (!nombreModo) return false;

  const nombrePista = normalizarTextoPista(data && data.nombre);
  const localidadPista = normalizarTextoPista(data && data.localidad);
  if (nombrePista !== nombreModo) return false;
  if (localidadModo && localidadPista !== localidadModo) return false;

  return true;
}

window.abrirPistas = function() {
  limpiarFormularioPistaNueva();
  const inputFotoEditar = document.getElementById("editarInputFotoPista");
  if (inputFotoEditar) inputFotoEditar.value = "";
  window.modoCrearPista = false;
  window.modoEditarPista = false;
  window.pistaUnicaDesdePartida = null;
  localStorage.removeItem("pistaSeleccionada");
  mostrar("pistas");
};

window.mostrarPistaUnicaDesdePartida = function(datos) {
  datos = datos || {};
  window.pistaUnicaDesdePartida = {
    pistaId: datos.pistaId || null,
    nombre: datos.nombre || null,
    localidad: datos.localidad || null
  };
  window.filtrosActivos = false;

  const filtros = document.getElementById("filtrosPistas");
  if (filtros) filtros.style.display = "none";

  localStorage.removeItem("pistaSeleccionada");
  mostrar("pistas");
};

function esPistaPrivadaComunidad(data) {
  const tipo = String((data && data.tipo) || "").toLowerCase().trim();
  return tipo === "privada" || tipo === "privada comunidad";
}

function pistaPrivadaPerteneceAUsuario(data, uid) {
  return !esPistaPrivadaComunidad(data) || (!!uid && data && data.creadaPor === uid);
}

function esPropietarioPistaPrivada(data, uid) {
  return !!uid && !!data && data.tipo === "privada" && data.creadaPor === uid;
}

async function usuarioEsAdminPistas(user) {
  if (!user) return false;

  const docUser = await db.collection("usuarios").doc(user.uid).get();
  if (!docUser.exists) return false;

  const data = docUser.data() || {};
  return data.admin === true || data.rol === "admin";
}

function limpiarListenerPistas() {
  if (typeof window.unsubscribePistas === "function") {
    window.unsubscribePistas();
  }
  window.unsubscribePistas = null;
}

window.limpiarListenerPistas = limpiarListenerPistas;

async function cargarPistas() {
  esAdmin = false;
  const user = auth.currentUser;
  if (user) {
    const docUser = await db.collection("usuarios").doc(user.uid).get();
    if (docUser.exists) {
      const dataUsuario = docUser.data() || {};
      esAdmin = dataUsuario.admin === true || dataUsuario.rol === "admin";
    }
  }

  const lista = document.getElementById("listaPistas");
  if (!lista) return;

  const pistaSeleccionada = localStorage.getItem("pistaSeleccionada");

  limpiarListenerPistas();

  window.unsubscribePistas = db.collection("pistas")
    .onSnapshot(snapshot => {
      lista.replaceChildren();
      let docs = snapshot.docs;
      const modoPistaUnica = window.pistaUnicaDesdePartida || null;

      if (modoPistaUnica) {
        docs = docs.filter(function(doc) {
          return pistaCoincideConModoUnico(doc, doc.data() || {}, modoPistaUnica);
        });

        if (docs.length === 0) {
          lista.replaceChildren(crearTextoPista("No se ha encontrado la pista de esta partida"));
          return;
        }
      }

      if (!modoPistaUnica && window.filtrosActivos) {
        const ordenPrecio = document.getElementById("ordenPrecio").value;

        if (ordenPrecio) {
          docs.sort((a, b) => {
            const da = a.data();
            const dbb = b.data();
            const a1 = da.precioManana || 0;
            const b1 = dbb.precioManana || 0;
            if (a1 !== b1) return ordenPrecio === "asc" ? a1 - b1 : b1 - a1;

            const a2 = da.precioTarde || 0;
            const b2 = dbb.precioTarde || 0;
            if (a2 !== b2) return ordenPrecio === "asc" ? a2 - b2 : b2 - a2;

            const a3 = da.precioFestivo || 0;
            const b3 = dbb.precioFestivo || 0;
            return ordenPrecio === "asc" ? a3 - b3 : b3 - a3;
          });
        }
      }

      const fragment = document.createDocumentFragment();

      docs.forEach(doc => {
        const data = doc.data();

        if (
          window.modoSeleccionPista &&
          !pistaPrivadaPerteneceAUsuario(data, user && user.uid)
        ) {
          return;
        }

        if (!modoPistaUnica && window.filtrosActivos) {
          const texto = document.getElementById("buscarTexto").value.toLowerCase();
          const localidadFiltro = document.getElementById("filtroLocalidad").value;
          const tipoFiltro = document.getElementById("filtroTipo").value;
          const filtroIndoorOutdoor = document.getElementById("filtroPistasTipo").value;
          const normalizar = (str) =>
            (str || "")
              .toString()
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");

          const textoNorm = normalizar(texto);
          const nombreNorm = normalizar(data.nombre);

          if (textoNorm && !nombreNorm.includes(textoNorm)) return;
          if (localidadFiltro && data.localidad !== localidadFiltro) return;
          if (tipoFiltro && data.tipo !== tipoFiltro) return;
          if (filtroIndoorOutdoor === "indoor" && (!data.indoor || data.indoor === 0)) return;
          if (filtroIndoorOutdoor === "outdoor" && (!data.outdoor || data.outdoor === 0)) return;
        }

        const div = document.createElement("div");
        div.className = "cardPista";

        if (pistaSeleccionada && doc.id === pistaSeleccionada) {
          div.style.border = "2px solid #1565C0";
          div.style.background = "#E3F2FD";
          setTimeout(function() {
            div.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
        }

        const imagen = document.createElement("img");
        imagen.src = data.imagen || data.imagenUrl || "";
        imagen.alt = data.nombre ? "Imagen de " + data.nombre : "Imagen de pista";
        imagen.loading = "lazy";
        imagen.decoding = "async";
        div.appendChild(imagen);

        const info = document.createElement("div");
        info.className = "cardPistaInfo";

        const nombre = document.createElement("strong");
        nombre.textContent = data.nombre || "";
        info.appendChild(nombre);

        if (data.verificada) {
          const verificada = document.createElement("span");
          verificada.className = "verificada";
          verificada.textContent = " Verificada";
          info.appendChild(verificada);
        }

        info.appendChild(document.createElement("br"));
        info.appendChild(crearTextoPista(data.tipo || ""));
        info.appendChild(crearTextoPista((data.localidad || "") + (data.direccion ? " | " + data.direccion : "")));
        info.appendChild(crearTextoPista("Indoor: " + (data.indoor || 0) + " | Outdoor: " + (data.outdoor || 0)));
        const precio = crearTextoPista(
          (data.precioManana || 0) + "€/pers. mañana | " +
          (data.precioTarde || 0) + "€/pers. tarde | " +
          (data.precioFestivo || 0) + "€/pers. finde/festivo"
        );

        const reserva = document.createElement("div");
        if (esPistaPrivadaComunidad(data)) {
          reserva.textContent = "Reserva: Solo puede reservar el creador de la pista";
        } else if (data.reserva && data.reserva.startsWith("http")) {
          reserva.appendChild(document.createTextNode("Reserva: "));
          const link = document.createElement("a");
          link.href = data.reserva;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = "WEB";
          reserva.appendChild(link);
        } else {
          reserva.textContent = "Reserva: " + data.reserva;
        }

        const pago = crearTextoPista("Pago: " +
          (data.formaPago === "reserva" ? "Al reservar" :
           data.formaPago === "pista" ? "En pista" :
           "No se paga")
        );

        const notaTexto = (data.nota || "").trim();

        info.appendChild(precio);
        info.appendChild(reserva);
        info.appendChild(pago);

        if (notaTexto) {
          const nota = crearTextoPista("Nota: " + notaTexto);
          nota.className = "notaPista";
          info.appendChild(nota);
        }

        if (data.lat && data.lng) {
          const mapaWrap = document.createElement("div");
          mapaWrap.style.marginTop = "10px";
          mapaWrap.appendChild(crearBotonPista("Como llegar", "btnBlue", function() {
            abrirMapa(data.lat, data.lng);
          }));
          info.appendChild(mapaWrap);
        }

        const propietarioPrivada = esPropietarioPistaPrivada(data, user && user.uid);
        if (esAdmin || propietarioPrivada) {
          const adminWrap = document.createElement("div");
          adminWrap.style.marginTop = "10px";
          adminWrap.appendChild(crearBotonPista("Editar", "btnEditar", function() {
            abrirEditarPista(doc.id);
          }));
          adminWrap.appendChild(crearBotonPista("Eliminar", "btnEliminar", function(event, boton) {
            if (typeof window.eliminarPista === "function") window.eliminarPista(doc.id, boton);
          }));

          if (esAdmin && !data.verificada) {
            adminWrap.appendChild(crearBotonPista("Verificar", "btnVerificar", function() {
              verificarPista(doc.id);
            }));
          }

          info.appendChild(adminWrap);
        }

        if (window.modoSeleccionPista) {
          info.appendChild(crearBotonPista("Anadir a partida", "btnBlue", function() {
            seleccionarPistaPartida(doc.id, data.nombre || "");
          }));
        }

        div.appendChild(info);

        fragment.appendChild(div);
      });

      lista.replaceChildren(fragment);

      setTimeout(() => {
        resetScrollPistas();
      }, 200);
    });

  localStorage.removeItem("pistaSeleccionada");
}

async function borrarImagen(url) {
  return borrarImagenStoragePistaSiProcede(url);
}

async function borrarImagenStoragePistaSiProcede(url) {
  if (typeof window.borrarImagenStorageSiProcede === "function") {
    return window.borrarImagenStorageSiProcede(url, ["pistas/", "imagenesPistas/"]);
  }

  return false;
}

function obtenerImagenesStoragePista(data) {
  data = data || {};
  return [data.imagen, data.imagenUrl].filter(Boolean).filter(function(url, index, lista) {
    return lista.indexOf(url) === index;
  });
}

window.verificarPista = async function(id) {
  const user = auth.currentUser;
  if (!user) return;

  const docUser = await db.collection("usuarios").doc(user.uid).get();
  if (!docUser.exists) return;
  const dataUsuario = docUser.data() || {};
  if (dataUsuario.admin !== true && dataUsuario.rol !== "admin") return;

  await db.collection("pistas").doc(id).update({
    verificada: true,
    verificadaPor: user.uid,
    fechaVerificada: firebase.firestore.FieldValue.serverTimestamp()
  });

  cargarPistas();
};

window.eliminarPista = async function(id, boton) {
  const estadoBoton = bloquearBotonAccion(boton, "Eliminando...");
  if (estadoBoton.bloqueado) return;
  try {
  const user = auth.currentUser;
  if (!user || !id) return;

  const ref = db.collection("pistas").doc(id);
  const resultados = await Promise.all([ref.get(), usuarioEsAdminPistas(user)]);
  const doc = resultados[0];
  const admin = resultados[1];
  if (!doc.exists) return;

  const data = doc.data() || {};
  if (!admin && !esPropietarioPistaPrivada(data, user.uid)) {
    alert("Solo el creador puede eliminar esta pista privada.");
    return;
  }
  if (!confirm("¿Eliminar esta pista?")) return;

  const imagenesActuales = obtenerImagenesStoragePista(data);

  await ref.delete();
  for (let i = 0; i < imagenesActuales.length; i++) {
    const borrada = await borrarImagenStoragePistaSiProcede(imagenesActuales[i]);
    if (!borrada) {
      console.warn("La pista se eliminó, pero su imagen no se pudo borrar de Storage.");
    }
  }
  cargarPistas();
  } catch (error) {
    console.error("No se pudo eliminar la pista:", error && error.code ? error.code : "error");
    alert(error && error.message ? error.message : "No se pudo eliminar la pista.");
  } finally {
    restaurarBotonAccion(estadoBoton);
  }
};

window.abrirMapa = function(lat, lng) {
  const url = "https://www.google.com/maps?q=" + lat + "," + lng;
  window.open(url, "_blank");
};

window.abrirEditarPista = async function(id) {
  const user = auth.currentUser;
  if (!user || !id) return;

  const doc = await db.collection("pistas").doc(id).get();
  if (!doc.exists) return;
  const data = doc.data();
  const admin = await usuarioEsAdminPistas(user);
  if (!admin && !esPropietarioPistaPrivada(data, user.uid)) {
    alert("Solo el creador puede editar esta pista privada.");
    return;
  }

  document.getElementById("editarNombrePista").value = data.nombre || "";
  document.getElementById("editarDireccionPista").value = data.direccion || "";
  document.getElementById("editarLat").value = data.lat || "";
  document.getElementById("editarLng").value = data.lng || "";
  document.getElementById("editarReserva").value = data.reserva || "";
  document.getElementById("editarNotaPista").value = (data.nota || "").trim();

  const fp = document.getElementById("formaPagoEditar");
  if (fp) fp.value = data.formaPago || "";

  document.getElementById("editarLocalidadPista").value = data.localidad || "";
  document.getElementById("editarTipoPista").value = data.tipo || "";
  document.getElementById("editarIndoor").value = data.indoor !== undefined ? data.indoor : "";
  document.getElementById("editarOutdoor").value = data.outdoor !== undefined ? data.outdoor : "";
  document.getElementById("editarPrecioManana").value = data.precioManana || "";
  document.getElementById("editarPrecioTarde").value = data.precioTarde || "";
  document.getElementById("editarPrecioFestivo").value = data.precioFestivo || "";

  window.pistaEditando = id;
  window.modoCrearPista = false;
  window.modoEditarPista = true;
  mostrar("editarPista");
};

const btnActualizar = document.getElementById("btnActualizarPista");

if (btnActualizar) {
  btnActualizar.onclick = async (event) => {
    const estadoBoton = bloquearBotonAccion(event, "Guardando...");
    if (estadoBoton.bloqueado) return;
    try {
    const user = auth.currentUser;
    if (!user || !window.pistaEditando) return;

    const nota = document.getElementById("editarNotaPista").value.trim();

    if (nota.length > 120) {
      alert("La nota no puede superar los 120 caracteres");
      return;
    }

    const pistaRef = db.collection("pistas").doc(window.pistaEditando);
    const docAnterior = await pistaRef.get();
    if (!docAnterior.exists) return;
    const datosAnteriores = docAnterior.exists ? (docAnterior.data() || {}) : {};
    const admin = await usuarioEsAdminPistas(user);
    if (!admin && !esPropietarioPistaPrivada(datosAnteriores, user.uid)) {
      alert("Solo el creador puede editar esta pista privada.");
      return;
    }
    const inputFotoEditar = document.getElementById("editarInputFotoPista");
    const archivoImagen = inputFotoEditar && inputFotoEditar.files.length > 0 ? inputFotoEditar.files[0] : null;
    const datosUpdate = {
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
      nota: nota,
      formaPago: document.getElementById("formaPagoEditar").value
    };

    if (!admin && datosUpdate.tipo !== "privada") {
      alert("Una pista privada debe seguir siendo privada.");
      return;
    }

    if (admin) datosUpdate.verificada = true;

    if (archivoImagen) {
      const ruta = "pistas/" + user.uid + "/pista_" + Date.now() + ".jpg";
      try {
        datosUpdate.imagen = await subirImagen(ruta, archivoImagen, "pista-edicion");
        datosUpdate.imagenUrl = firebase.firestore.FieldValue.delete();
      } catch (error) {
        alert(error && error.message ? error.message : "No se pudo preparar la imagen.");
        return;
      }
    }

    try {
      await pistaRef.update(datosUpdate);
    } catch (error) {
      await borrarImagenStoragePistaSiProcede(datosUpdate.imagen || "");
      throw error;
    }
    if (datosUpdate.imagen) {
      const imagenesAnteriores = obtenerImagenesStoragePista(datosAnteriores);
      for (let i = 0; i < imagenesAnteriores.length; i++) {
        await borrarImagenStoragePistaSiProcede(imagenesAnteriores[i]);
      }
      if (inputFotoEditar) inputFotoEditar.value = "";
    }

    window.pistasCargadas = false;
    abrirPistas();
    } catch (error) {
      console.error("No se pudo actualizar la pista:", error && error.code ? error.code : "error");
      alert(error && error.message ? error.message : "No se pudo guardar la pista.");
    } finally {
      restaurarBotonAccion(estadoBoton);
    }
  };
}

window.aplicarFiltros = function() {
  window.filtrosActivos = true;
  cargarPistas();
};

window.limpiarFiltros = function() {
  document.getElementById("buscarTexto").value = "";
  document.getElementById("filtroLocalidad").value = "";
  document.getElementById("filtroTipo").value = "";
  document.getElementById("ordenPrecio").value = "";
  document.getElementById("filtroPistasTipo").value = "";
  window.filtrosActivos = false;

  const filtros = document.getElementById("filtrosPistas");
  if (filtros) filtros.style.display = "none";

  const btn = document.querySelector(".btnGreen");
  if (btn) btn.style.display = "block";

  cargarPistas();
};

window.toggleFiltros = function() {
  const filtros = document.getElementById("filtrosPistas");
  const btn = document.querySelector(".btnGreen");
  if (!filtros) return;

  if (filtros.style.display === "none") {
    filtros.style.display = "block";
    if (btn) btn.style.display = "none";
  } else {
    filtros.style.display = "none";
    if (btn) btn.style.display = "block";
  }
};
