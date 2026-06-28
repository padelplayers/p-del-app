window.modoSeleccionPista = false;
window.partidaCreando = {};

function resolverBotonAccion(boton) {
  if (!boton) return null;
  if (boton.currentTarget) boton = boton.currentTarget;
  if (boton.target && !boton.tagName) boton = boton.target;
  if (!boton || !boton.tagName) return null;
  if (String(boton.tagName).toLowerCase() !== "button") return null;
  return boton;
}

function bloquearBotonAccion(boton, textoProcesando) {
  boton = resolverBotonAccion(boton);
  if (!boton) return { boton: null, bloqueado: false };
  if (boton.dataset.procesandoAccion === "true") {
    return { boton: boton, bloqueado: true };
  }

  const estado = {
    boton: boton,
    texto: boton.textContent,
    disabled: boton.disabled,
    bloqueado: false
  };
  boton.dataset.procesandoAccion = "true";
  boton.disabled = true;
  if (textoProcesando) boton.textContent = textoProcesando;
  return estado;
}

function restaurarBotonAccion(estado) {
  if (!estado || !estado.boton) return;
  estado.boton.disabled = estado.disabled;
  estado.boton.textContent = estado.texto;
  delete estado.boton.dataset.procesandoAccion;
}

window.bloquearBotonAccion = bloquearBotonAccion;
window.restaurarBotonAccion = restaurarBotonAccion;

const HORAS_RETENCION_REGISTRO_INCOMPLETO = 72;
const MS_DIA_REGISTRO_INCOMPLETO = 24 * 60 * 60 * 1000;
const MS_HORA_REGISTRO_INCOMPLETO = 60 * 60 * 1000;

function obtenerMillisRegistroIncompletoAdmin(datos) {
  const valor = datos && (datos.registroIniciadoAt || datos.fechaAlta || datos.createdAt);
  if (!valor) return null;
  if (typeof valor.toMillis === "function") return valor.toMillis();
  if (typeof valor.toDate === "function") return valor.toDate().getTime();
  const millis = new Date(valor).getTime();
  return Number.isFinite(millis) ? millis : null;
}

function calcularAntiguedadRegistroIncompleto(datos, ahoraMs) {
  const iniciadoMs = obtenerMillisRegistroIncompletoAdmin(datos);
  return Number.isFinite(iniciadoMs)
    ? Math.max(0, Math.floor((ahoraMs - iniciadoMs) / MS_DIA_REGISTRO_INCOMPLETO))
    : null;
}

function esRegistroIncompletoAntiguo(datos, ahoraMs, horasMinimas) {
  if (!datos || datos.perfilCompleto !== false) return false;
  const iniciadoMs = obtenerMillisRegistroIncompletoAdmin(datos);
  return Number.isFinite(iniciadoMs) &&
    ahoraMs - iniciadoMs >= horasMinimas * MS_HORA_REGISTRO_INCOMPLETO;
}

function obtenerEmailRegistroIncompleto(datos) {
  const email = datos && (datos.email || datos.correo || datos.authEmail);
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

function valorFechaAuditoriaAuth(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor;
  if (typeof valor.toMillis === "function") return valor;
  const fecha = new Date(valor);
  return Number.isFinite(fecha.getTime())
    ? firebase.firestore.Timestamp.fromDate(fecha)
    : null;
}

function formatearFechaAuditoriaAuth(valor) {
  if (!valor) return "Sin fecha";
  let fecha = null;
  if (typeof valor.toDate === "function") fecha = valor.toDate();
  else if (typeof valor.toMillis === "function") fecha = new Date(valor.toMillis());
  else fecha = new Date(valor);
  return Number.isFinite(fecha.getTime()) ? fecha.toLocaleString() : "Sin fecha";
}

async function comprobarAdminRegistrosIncompletos() {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes iniciar sesion.");

  const adminDoc = await db.collection("usuarios").doc(user.uid).get();
  const datosAdmin = adminDoc.exists ? (adminDoc.data() || {}) : {};
  if (datosAdmin.admin !== true && datosAdmin.rol !== "admin") {
    throw new Error("Herramienta disponible solo para admin.");
  }

  return user;
}

async function auditarRegistrosIncompletosAdmin() {
  const user = auth.currentUser;
  const boton = document.getElementById("btnAuditarRegistrosIncompletos");
  const salida = document.getElementById("auditoriaRegistrosIncompletos");
  if (!user || !salida) return [];

  if (boton) boton.disabled = true;
  salida.textContent = "Auditando usuarios...";

  try {
    await comprobarAdminRegistrosIncompletos();

    const snapshot = await db.collection("usuarios").get();
    const ahora = Date.now();
    const horasMinimas = HORAS_RETENCION_REGISTRO_INCOMPLETO;
    const pendientes = [];

    snapshot.forEach(function(doc) {
      const datos = doc.data() || {};
      if (datos.perfilCompleto === true) return;
      const antiguedadDias = calcularAntiguedadRegistroIncompleto(datos, ahora);
      pendientes.push({
        uid: doc.id,
        estado: datos.perfilCompleto === false ? "Registro incompleto" : "Sin marca perfilCompleto",
        antiguedadDias: antiguedadDias,
        revisable: esRegistroIncompletoAntiguo(datos, ahora, horasMinimas)
      });
    });

    pendientes.sort(function(a, b) {
      return (b.antiguedadDias === null ? -1 : b.antiguedadDias) -
        (a.antiguedadDias === null ? -1 : a.antiguedadDias);
    });

    salida.replaceChildren();
    const resumen = document.createElement("p");
    resumen.className = "auditoriaRegistrosResumen";
    resumen.textContent = pendientes.length + " documento(s) incompleto(s). Se borran automaticamente solo los perfilCompleto:false con registroIniciadoAt de " + horasMinimas + " horas o mas.";
    salida.appendChild(resumen);

    pendientes.forEach(function(item) {
      const fila = document.createElement("div");
      fila.className = "auditoriaRegistroFila" + (item.revisable ? " auditoriaRegistroAntiguo" : "");
      const antiguedad = item.antiguedadDias === null ? "Antiguedad desconocida" : item.antiguedadDias + " dias";
      fila.textContent = item.estado + " | " + antiguedad + " | UID: " + item.uid;
      salida.appendChild(fila);
    });

    if (pendientes.length === 0) resumen.textContent = "No hay documentos de usuario incompletos.";
    return pendientes;
  } catch (error) {
    console.error("No se pudo auditar registros incompletos:", error && error.code ? error.code : "error");
    salida.textContent = error.message || "No se pudo completar la auditoria.";
    return [];
  } finally {
    if (boton) boton.disabled = false;
  }
}

window.auditarRegistrosIncompletosAdmin = auditarRegistrosIncompletosAdmin;

async function registrarPendienteAuthAntesDeBorrar(candidato) {
  const datos = candidato.datos || {};
  const pendiente = {
    uid: candidato.uid,
    email: obtenerEmailRegistroIncompleto(datos),
    fechaRegistro: valorFechaAuditoriaAuth(datos.registroIniciadoAt || datos.fechaAlta || datos.createdAt),
    fechaLimpieza: firebase.firestore.FieldValue.serverTimestamp(),
    motivo: "registro_incompleto",
    estado: "pendiente"
  };

  await db.collection("limpieza_auth_pendiente").doc(candidato.uid).set(pendiente);
  return pendiente;
}

async function limpiarRegistrosIncompletosAntiguosAdmin() {
  const boton = document.getElementById("btnLimpiarRegistrosIncompletos");
  const salida = document.getElementById("auditoriaRegistrosIncompletos");
  const estadoBoton = bloquearBotonAccion(boton, "Limpiando...");
  if (estadoBoton.bloqueado) return null;

  try {
    await comprobarAdminRegistrosIncompletos();
    if (salida) salida.textContent = "Buscando registros incompletos antiguos...";

    const snapshot = await db.collection("usuarios")
      .where("perfilCompleto", "==", false)
      .get();
    const ahora = Date.now();
    const candidatos = [];
    const recientes = [];
    const sinFecha = [];

    snapshot.forEach(function(doc) {
      const datos = doc.data() || {};
      const antiguedadDias = calcularAntiguedadRegistroIncompleto(datos, ahora);
      if (esRegistroIncompletoAntiguo(datos, ahora, HORAS_RETENCION_REGISTRO_INCOMPLETO)) {
        candidatos.push({ uid: doc.id, ref: doc.ref, datos: datos, antiguedadDias: antiguedadDias });
      } else if (Number.isFinite(antiguedadDias)) {
        recientes.push({ uid: doc.id, antiguedadDias: antiguedadDias });
      } else {
        sinFecha.push(doc.id);
      }
    });

    const eliminados = [];
    const errores = [];
    for (let i = 0; i < candidatos.length; i++) {
      const candidato = candidatos[i];
      try {
        const pendienteAuth = await registrarPendienteAuthAntesDeBorrar(candidato);
        await candidato.ref.delete();
        eliminados.push({
          uid: candidato.uid,
          email: pendienteAuth.email,
          antiguedadDias: candidato.antiguedadDias
        });
      } catch (error) {
        errores.push({
          uid: candidato.uid,
          codigo: error && error.code ? error.code : "error",
          mensaje: error && error.message ? error.message : String(error)
        });
      }
    }

    const resultado = {
      plazoHoras: HORAS_RETENCION_REGISTRO_INCOMPLETO,
      revisados: snapshot.size,
      candidatos: candidatos.length,
      eliminados: eliminados,
      recientes: recientes,
      sinFecha: sinFecha,
      errores: errores,
      auth: "El cliente no puede eliminar cuentas de Authentication de otros usuarios; requiere Firebase Console, Admin SDK o Cloud Function."
    };

    if (salida) {
      salida.replaceChildren();
      const resumen = document.createElement("p");
      resumen.className = "auditoriaRegistrosResumen";
      resumen.textContent = "Limpieza completada. Revisados: " + resultado.revisados +
        ". Eliminados: " + eliminados.length +
        ". Recientes conservados: " + recientes.length +
        ". Sin fecha conservados: " + sinFecha.length +
        ". Errores: " + errores.length + ".";
      salida.appendChild(resumen);

      eliminados.forEach(function(item) {
        const fila = document.createElement("div");
        fila.className = "auditoriaRegistroFila auditoriaRegistroAntiguo";
        fila.textContent = "Eliminado Firestore y añadido a Auth pendiente | " +
          (item.email || "Sin email guardado") +
          " | " + item.antiguedadDias + " dias | UID: " + item.uid;
        salida.appendChild(fila);
      });

      errores.forEach(function(item) {
        const fila = document.createElement("div");
        fila.className = "auditoriaRegistroFila";
        fila.textContent = "Error " + item.codigo + " | UID: " + item.uid;
        salida.appendChild(fila);
      });
    }

    if (typeof cargarCuentasAuthPendientesAdmin === "function") {
      cargarCuentasAuthPendientesAdmin().catch(function(error) {
        console.warn("No se pudo refrescar la lista de Auth pendiente:", error.message);
      });
    }

    return resultado;
  } catch (error) {
    console.error("No se pudo limpiar registros incompletos:", error && error.code ? error.code : "error");
    if (salida) salida.textContent = error.message || "No se pudo completar la limpieza.";
    return null;
  } finally {
    restaurarBotonAccion(estadoBoton);
  }
}

window.limpiarRegistrosIncompletosAntiguosAdmin = limpiarRegistrosIncompletosAntiguosAdmin;

function crearTextoAuthPendiente(texto, className) {
  const div = document.createElement("div");
  if (className) div.className = className;
  div.textContent = texto;
  return div;
}

async function cargarCuentasAuthPendientesAdmin() {
  const lista = document.getElementById("limpiezaAuthPendienteLista");
  if (!lista) return [];

  lista.replaceChildren(crearTextoAuthPendiente("Cargando cuentas pendientes..."));

  try {
    await comprobarAdminRegistrosIncompletos();
    const snapshot = await db.collection("limpieza_auth_pendiente")
      .where("estado", "==", "pendiente")
      .get();
    const pendientes = [];
    snapshot.forEach(function(doc) {
      const data = doc.data() || {};
      pendientes.push({
        id: doc.id,
        uid: data.uid || doc.id,
        email: obtenerEmailRegistroIncompleto(data),
        fechaLimpieza: data.fechaLimpieza || null,
        fechaRegistro: data.fechaRegistro || null,
        motivo: data.motivo || "registro_incompleto"
      });
    });

    pendientes.sort(function(a, b) {
      const fechaA = obtenerMillisRegistroIncompletoAdmin({ registroIniciadoAt: a.fechaLimpieza }) || 0;
      const fechaB = obtenerMillisRegistroIncompletoAdmin({ registroIniciadoAt: b.fechaLimpieza }) || 0;
      return fechaB - fechaA;
    });

    lista.replaceChildren();
    if (pendientes.length === 0) {
      lista.appendChild(crearTextoAuthPendiente("No hay cuentas Authentication pendientes de borrar.", "auditoriaRegistrosResumen"));
      return pendientes;
    }

    pendientes.forEach(function(item) {
      const fila = document.createElement("div");
      fila.className = "auditoriaRegistroFila auditoriaRegistroAntiguo";

      const detalle = document.createElement("div");
      detalle.textContent = "Email: " + (item.email || "Sin email guardado") +
        " | UID: " + item.uid +
        " | Limpieza: " + formatearFechaAuditoriaAuth(item.fechaLimpieza) +
        " | Motivo: " + item.motivo;

      const boton = document.createElement("button");
      boton.className = "btnYellow";
      boton.type = "button";
      boton.textContent = "Marcar como borrado";
      boton.addEventListener("click", function() {
        marcarCuentaAuthPendienteBorrada(item.id, boton);
      });

      fila.appendChild(detalle);
      fila.appendChild(boton);
      lista.appendChild(fila);
    });

    return pendientes;
  } catch (error) {
    console.error("No se pudo cargar Auth pendiente:", error && error.code ? error.code : "error");
    lista.replaceChildren(crearTextoAuthPendiente(error.message || "No se pudo cargar la lista pendiente."));
    return [];
  }
}

async function marcarCuentaAuthPendienteBorrada(docId, boton) {
  const estadoBoton = bloquearBotonAccion(boton, "Marcando...");
  if (estadoBoton.bloqueado) return;

  try {
    await comprobarAdminRegistrosIncompletos();
    await db.collection("limpieza_auth_pendiente").doc(docId).set({
      estado: "borrado",
      fechaMarcadoBorrado: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await cargarCuentasAuthPendientesAdmin();
  } catch (error) {
    console.error("No se pudo marcar Auth como borrado:", error && error.code ? error.code : "error");
    alert(error.message || "No se pudo marcar como borrado.");
  } finally {
    restaurarBotonAccion(estadoBoton);
  }
}

window.cargarCuentasAuthPendientesAdmin = cargarCuentasAuthPendientesAdmin;
window.marcarCuentaAuthPendienteBorrada = marcarCuentaAuthPendienteBorrada;

const IMAGEN_STORAGE_PERFIL = {
  maxDimension: 512,
  maxBytes: 450 * 1024,
  maxOriginalBytes: 12 * 1024 * 1024
};
const IMAGEN_STORAGE_PISTA = {
  maxDimension: 1200,
  maxBytes: 900 * 1024,
  maxOriginalBytes: 20 * 1024 * 1024
};

function configuracionImagenStorage(ruta) {
  if (String(ruta || "").indexOf("usuarios/") === 0 || String(ruta || "").indexOf("fotosPerfil/") === 0) {
    return IMAGEN_STORAGE_PERFIL;
  }
  if (String(ruta || "").indexOf("pistas/") === 0 || String(ruta || "").indexOf("imagenesPistas/") === 0) {
    return IMAGEN_STORAGE_PISTA;
  }
  return null;
}

function cargarImagenLocal(archivo) {
  return new Promise(function(resolve, reject) {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();

    imagen.onload = function() {
      URL.revokeObjectURL(url);
      resolve(imagen);
    };
    imagen.onerror = function() {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen seleccionada."));
    };
    imagen.src = url;
  });
}

function convertirCanvasJpeg(canvas, calidad) {
  return new Promise(function(resolve, reject) {
    canvas.toBlob(function(blob) {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo optimizar la imagen."));
    }, "image/jpeg", calidad);
  });
}

async function optimizarImagenParaStorage(ruta, archivo) {
  const config = configuracionImagenStorage(ruta);
  if (!config) return archivo;
  if (!archivo || !String(archivo.type || "").startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen valido.");
  }
  if (archivo.size > config.maxOriginalBytes) {
    const limiteMb = Math.round(config.maxOriginalBytes / (1024 * 1024));
    throw new Error("La imagen original no puede superar " + limiteMb + " MB.");
  }

  const imagen = await cargarImagenLocal(archivo);
  const anchoOriginal = Number(imagen.naturalWidth || imagen.width || 0);
  const altoOriginal = Number(imagen.naturalHeight || imagen.height || 0);
  if (!anchoOriginal || !altoOriginal || anchoOriginal * altoOriginal > 50000000) {
    throw new Error("La resolucion de la imagen es demasiado grande.");
  }

  const escalaInicial = Math.min(1, config.maxDimension / Math.max(anchoOriginal, altoOriginal));
  let ancho = Math.max(1, Math.round(anchoOriginal * escalaInicial));
  let alto = Math.max(1, Math.round(altoOriginal * escalaInicial));
  const calidades = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46];

  for (let intento = 0; intento < 6; intento++) {
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const contexto = canvas.getContext("2d", { alpha: false });
    if (!contexto) throw new Error("El navegador no puede optimizar esta imagen.");

    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, ancho, alto);
    contexto.drawImage(imagen, 0, 0, ancho, alto);

    for (let i = 0; i < calidades.length; i++) {
      const blob = await convertirCanvasJpeg(canvas, calidades[i]);
      if (blob.size <= config.maxBytes) return blob;
    }

    ancho = Math.max(1, Math.round(ancho * 0.82));
    alto = Math.max(1, Math.round(alto * 0.82));
  }

  throw new Error("No se pudo reducir la imagen al tamano permitido.");
}

window.optimizarImagenParaStorage = optimizarImagenParaStorage;

window.subirImagen = async function(ruta, archivo, flujo) {
  const config = configuracionImagenStorage(ruta);

  const imagenOptimizada = await optimizarImagenParaStorage(ruta, archivo);

  if (config && imagenOptimizada === archivo) {
    throw new Error("Seguridad de imagen: se intento subir el archivo original sin optimizar.");
  }
  if (config && imagenOptimizada.size > config.maxBytes) {
    throw new Error("Seguridad de imagen: el archivo optimizado supera el limite final.");
  }
  if (config && imagenOptimizada.type !== "image/jpeg") {
    throw new Error("Seguridad de imagen: el resultado optimizado no es JPEG.");
  }

  const ref = firebase.storage().ref().child(ruta);

  await ref.put(imagenOptimizada, {
    contentType: imagenOptimizada.type || archivo.type || "image/jpeg",
    cacheControl: "public,max-age=31536000,immutable"
  });

  const url = await ref.getDownloadURL();

  return url;
}

const STORAGE_RUTAS_IMAGENES_APP = ["usuarios/", "fotosPerfil/", "pistas/", "imagenesPistas/"];
const STORAGE_IMAGENES_DEFAULT_APP = ["imagen/hombre.jpeg", "imagen/mujer.jpeg"];

function obtenerFotosStorageUsuario(data) {
  data = data || {};
  return [data.fotoPerfil, data.fotoUrl, data.imagenUrl, data.photoURL, data.avatar, data.foto]
    .filter(Boolean)
    .filter(function(url, index, lista) {
      return lista.indexOf(url) === index;
    });
}

function obtenerImagenPerfilPorDefecto(data) {
  data = data || {};
  const sexo = normalizarTexto(String(data.sexo || data.genero || data.gender || ""));
  return sexo === "mujer" || sexo === "femenino" || sexo === "female"
    ? "imagen/mujer.jpeg"
    : "imagen/hombre.jpeg";
}

function obtenerStoragePathDesdeUrl(url) {
  if (!url || typeof url !== "string") return "";
  const valor = url.trim();
  if (!valor || STORAGE_IMAGENES_DEFAULT_APP.includes(valor)) return "";
  if (
    valor.indexOf("firebasestorage.googleapis.com") === -1 &&
    valor.indexOf("storage.googleapis.com") === -1 &&
    valor.indexOf("gs://") !== 0
  ) {
    return "";
  }

  try {
    return firebase.storage().refFromURL(valor).fullPath || "";
  } catch (error) {
    return "";
  }
}

function esImagenStorageApp(url, rutasPermitidas) {
  const path = obtenerStoragePathDesdeUrl(url);
  const permitidas = Array.isArray(rutasPermitidas) && rutasPermitidas.length > 0
    ? rutasPermitidas
    : STORAGE_RUTAS_IMAGENES_APP;

  return !!path && permitidas.some(function(ruta) {
    return path.indexOf(ruta) === 0;
  });
}

async function borrarImagenStorageSiProcede(url, rutasPermitidas) {
  if (!esImagenStorageApp(url, rutasPermitidas)) return false;

  try {
    await firebase.storage().refFromURL(url).delete();
    return true;
  } catch (error) {
    if (error && error.code === "storage/object-not-found") return false;
    console.warn("No se pudo borrar imagen antigua de Storage:", error && error.message ? error.message : error);
    return false;
  }
}

window.obtenerStoragePathDesdeUrl = obtenerStoragePathDesdeUrl;
window.esImagenStorageApp = esImagenStorageApp;
window.borrarImagenStorageSiProcede = borrarImagenStorageSiProcede;
window.obtenerImagenPerfilPorDefecto = obtenerImagenPerfilPorDefecto;

let avisoNivelMostrado = false;



function mostrarAvisoNivel(){
  if (!avisoNivelMostrado) {
    avisoNivelMostrado = true;
    alert("Elige bien tu nivel. No podrás cambiarlo después.");
    return true;
  }
  return false;
}

function asegurarAvisoNivelAceptado(callback) {
  if (!avisoNivelMostrado) mostrarAvisoNivel();
  if (typeof callback === "function") callback();
}

function obtenerNivelesRegistro() {
  return [
    "0.5", "0.75", "1", "1.25", "1.5", "1.75", "2", "2.25", "2.5", "2.75",
    "3", "3.25", "3.5", "3.75", "4", "4.25", "4.5", "4.75", "5", "5.25",
    "5.5", "5.75", "6", "6.25", "6.5", "6.75", "7"
  ];
}

function marcarOpcionNivelManualRegistro(contenedor, nivelSeleccionado) {
  if (!contenedor) return;
  contenedor.querySelectorAll("button[data-nivel]").forEach(function(opcion) {
    const activa = opcion.dataset.nivel === nivelSeleccionado;
    opcion.classList.toggle("nivelManualOpcionSeleccionada", activa);
    opcion.setAttribute("aria-pressed", activa ? "true" : "false");
  });
}

function abrirSelectorNivelManualRegistro() {
  const contenedor = document.getElementById("nivelManualOpciones");
  if (!contenedor) return;

  if (contenedor.childElementCount === 0) {
    const fragment = document.createDocumentFragment();
    obtenerNivelesRegistro().forEach(function(nivel) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btnBlue";
      boton.style.margin = "4px";
      boton.textContent = nivel;
      boton.dataset.nivel = nivel;
      boton.setAttribute("aria-pressed", "false");
      boton.onclick = function() {
        seleccionarNivelManualRegistro(nivel);
      };
      fragment.appendChild(boton);
    });
    contenedor.appendChild(fragment);
  }

  const input = document.getElementById("nivelManual");
  marcarOpcionNivelManualRegistro(contenedor, input ? input.value : "");
  contenedor.style.display = "block";
}

function iniciarNivelManualRegistro() {
  asegurarAvisoNivelAceptado(abrirSelectorNivelManualRegistro);
}

function seleccionarNivelManualRegistro(nivel) {
  const input = document.getElementById("nivelManual");
  const boton = document.getElementById("btnNivelManual");
  const contenedor = document.getElementById("nivelManualOpciones");
  const nivelSeleccionado = nivel ? String(nivel) : "";
  if (input) input.value = nivelSeleccionado;
  if (boton) boton.textContent = nivelSeleccionado ? "Nivel " + nivelSeleccionado : "Elegir nivel";
  if (contenedor) {
    marcarOpcionNivelManualRegistro(contenedor, nivelSeleccionado);
    contenedor.style.display = "none";
  }
}

function iniciarTestNivelRegistro() {
  mostrar("testNivel");
  asegurarAvisoNivelAceptado();
}

let archivo = null;
let otroUid = null;

let esAdmin = false;

let unsubscribePistas = null;
let presenciaInterval = null;
let presenciaUidActual = null;
let presenciaEventosRegistrados = false;
let revisionCancelaciones5hSesionUid = null;

const PRESENCIA_HEARTBEAT_MS = 5 * 60 * 1000;


async function borrarImagen(url) {

  return borrarImagenStorageSiProcede(url);

}

function camposObligatoriosPerfilCompletos(data) {
  data = data || {};
  return !!(
    String(data.nombre || "").trim() &&
    String(data.sexo || "").trim() &&
    String(data.nivel || "").trim() &&
    String(data.mano || "").trim() &&
    String(data.posicion || "").trim()
  );
}

function perfilUsuarioCompleto(data) {
  data = data || {};
  if (data.perfilCompleto === true) return true;
  if (data.perfilCompleto === false) return false;
  return camposObligatoriosPerfilCompletos(data);
}

window.camposObligatoriosPerfilCompletos = camposObligatoriosPerfilCompletos;
window.perfilUsuarioCompleto = perfilUsuarioCompleto;
window.perfilSesionCompleto = false;


auth.onAuthStateChanged(async user => {
  if (user) {

    const doc = await db.collection("usuarios").doc(user.uid).get();
    const data = doc.exists ? (doc.data() || {}) : {};

    if (!perfilUsuarioCompleto(data)) {
      esAdmin = false;
      return;
    }

    esAdmin = data && (data.admin === true || data.rol === "admin");

    if (typeof window.asegurarRestriccionFiabilidadUsuario === "function") {
      await window.asegurarRestriccionFiabilidadUsuario(user.uid, data || {}).catch(function(error) {
        console.warn("No se pudo revisar la restriccion por fiabilidad:", error.message);
      });
    }

    // El listener principal de autenticacion decide la pantalla inicial.

  }
});

function normalizarTexto(texto){
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function actualizarPresenciaUsuario(uid, online) {
  const user = auth.currentUser;
  if (!uid || !user || user.uid !== uid) return false;

  const userRef = db.collection("usuarios").doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) return false;

  const datos = userDoc.data() || {};
  if (datos.perfilCompleto !== true) return false;

  await userRef.update({
    online: online,
    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
  });
  return true;
}

function registrarEventosPresenciaAvanzada() {
  if (presenciaEventosRegistrados) return;
  presenciaEventosRegistrados = true;

  window.addEventListener("pagehide", function() {
    const user = auth.currentUser;
    if (user && presenciaUidActual === user.uid) {
      detenerPresenciaAvanzada(user.uid, true).catch(function(error) {
        console.warn("[PRESENCIA] No se pudo marcar offline al salir:", error && error.code ? error.code : error.message);
      });
    }
  });

  document.addEventListener("visibilitychange", function() {
    const user = auth.currentUser;
    if (!user) return;

    if (document.visibilityState === "visible") {
      iniciarPresenciaAvanzada(user.uid).catch(function(error) {
        console.warn("[PRESENCIA] No se pudo reactivar:", error && error.code ? error.code : error.message);
      });
    } else if (presenciaUidActual === user.uid) {
      detenerPresenciaAvanzada(user.uid, true).catch(function(error) {
        console.warn("[PRESENCIA] No se pudo marcar offline al ocultar:", error && error.code ? error.code : error.message);
      });
    }
  });
}

function detenerPresenciaAvanzada(uid, marcarOffline) {
  if (presenciaInterval) {
    clearInterval(presenciaInterval);
    presenciaInterval = null;
  }

  const uidSalida = uid || presenciaUidActual;
  presenciaUidActual = null;

  if (marcarOffline && uidSalida) {
    return actualizarPresenciaUsuario(uidSalida, false);
  }

  return Promise.resolve();
}

async function iniciarPresenciaAvanzada(uid) {
  const user = auth.currentUser;
  if (!uid || !user || user.uid !== uid) return false;

  registrarEventosPresenciaAvanzada();
  if (presenciaInterval) clearInterval(presenciaInterval);

  const presenciaActivada = await actualizarPresenciaUsuario(uid, true);
  if (!presenciaActivada) {
    presenciaInterval = null;
    presenciaUidActual = null;
    return false;
  }

  presenciaUidActual = uid;

  presenciaInterval = setInterval(function() {
    const user = auth.currentUser;
    if (!user || user.uid !== uid) {
      detenerPresenciaAvanzada(null, false);
      return;
    }

    actualizarPresenciaUsuario(uid, true).then(function(actualizada) {
      if (!actualizada) detenerPresenciaAvanzada(uid, false);
    }).catch(function(error) {
      console.warn("[PRESENCIA] No se pudo renovar:", error && error.code ? error.code : error.message);
    });
  }, PRESENCIA_HEARTBEAT_MS);

  return true;
}

function actualizarBotonEstadisticasAdmin() {
  const btnMenu = document.getElementById("btnMenuEstadisticas");
  const btnPerfil = document.getElementById("btnPerfilEstadisticas");
  const panelChatSistema = document.getElementById("adminChatSistemaPanel");
  if (btnMenu) btnMenu.style.display = esAdmin ? "flex" : "none";
  if (btnPerfil) btnPerfil.style.display = esAdmin ? "block" : "none";
  if (panelChatSistema) panelChatSistema.style.display = esAdmin ? "block" : "none";
}

function recuperarPassword() {
  const email = document.getElementById("email").value.trim();

  if (!email) {
   alert("Introduce tu email");
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => {
      alert("Te hemos enviado un correo para restablecer la contraseña. Revisa tu bandeja de entrada o spam");
    })
    .catch((error) => {
      console.warn("No se pudo enviar el email de recuperacion:", error && error.code ? error.code : "error");
      alert(error.code);
    });
}

function registro(){

let emailInput = document.getElementById("email");
let passInput = document.getElementById("pass");

if(!emailInput || !passInput){
alert("Error: inputs no encontrados");
return;
}

let email = emailInput.value;
let pass = passInput.value;

const checkEdad = document.getElementById("checkEdad");

if (!checkEdad || !checkEdad.checked) {
  alert("Debes confirmar que eres mayor de 16 años y que aceptas la Política de Privacidad y los Términos y Condiciones.");
  return;
}

auth.createUserWithEmailAndPassword(email, pass)
  .then(async cred => {
    const user = cred.user;
    await db.collection("usuarios").doc(user.uid).set({
      perfilCompleto: false,
      email: user.email || email,
      terminosAceptados: true,
      terminosAceptadosAt: firebase.firestore.FieldValue.serverTimestamp(),
      registroIniciadoAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    window.perfilSesionCompleto = false;
    mostrar("perfilCompletar");
  })
  .catch(e => {
    console.warn("No se pudo crear la cuenta:", e && e.code ? e.code : "error");
    alert(e.message);
  });

}


// REGISTRO PERFIL

async function guardarPerfilRegistroInterno(){
  const nombre = document.getElementById("nombre").value.trim();
  const sexo = document.getElementById("sexo").value;
  const nivel = document.getElementById("nivelManual").value;
  const mano = document.getElementById("mano").value;
  const posicion = document.getElementById("posicion").value;

  const inputFoto = document.getElementById("inputFotoRegistro");
  const archivo = inputFoto ? inputFoto.files[0] : null;

  if (!nombre || !sexo || !mano || !posicion) {
    document.getElementById("msgPerfil").innerText = "Completa los campos";
    return;
  }

  if (!nivel) {
    document.getElementById("msgPerfil").innerText = "Debes elegir o calcular tu nivel";
    return;
  }

  // BLOQUEO NOMBRE DUPLICADO
  const nombreNormalizado = normalizarTexto(nombre);

  const snapshot = await db.collection("usuarios")
    .where("nombreNormalizado", "==", nombreNormalizado)
    .get();
  if (!snapshot.empty) {
    document.getElementById("msgPerfil").innerText = "Nombre ya en uso";
    return;
  }

  const userRef = db.collection("usuarios").doc(auth.currentUser.uid);
  const userDoc = await userRef.get();
  const datosUsuarioExistente = userDoc.exists ? (userDoc.data() || {}) : {};
  const fotosAnteriores = obtenerFotosStorageUsuario(datosUsuarioExistente);
  let fotoURL = sexo === "mujer" ? "imagen/mujer.jpeg" : "imagen/hombre.jpeg";
  let fotoNuevaSubida = "";

  if (archivo) {
    const ruta = "usuarios/" + auth.currentUser.uid + "/foto_" + Date.now() + ".jpg";
    try {
      fotoURL = await subirImagen(ruta, archivo, "perfil-registro");
      fotoNuevaSubida = fotoURL;
    } catch (error) {
      document.getElementById("msgPerfil").innerText = error && error.message
        ? error.message
        : "No se pudo preparar la imagen.";
      return;
    }
  }

  const datosPerfil = {
    nombre: nombre,
    nombreNormalizado: nombreNormalizado,
    sexo: sexo,
    nivel: nivel,
    mano: mano,
    posicion: posicion,
    fotoPerfil: fotoURL,
    perfilCompleto: true,
    terminosAceptados: true,

    // estructura base obligatoria
    partidos: 0,
    seguidores: [],
    siguiendo: [],
    admin: false,
    online: true,
    lastSeen: firebase.firestore.FieldValue.serverTimestamp()

  };

  if (!datosUsuarioExistente.fechaAlta) {
    datosPerfil.fechaAlta = firebase.firestore.FieldValue.serverTimestamp();
  }

  try {
    await userRef.set(datosPerfil, { merge: true });
  } catch (error) {
    await borrarImagenStorageSiProcede(fotoNuevaSubida, ["usuarios/", "fotosPerfil/"]);
    console.error("No se pudo guardar el perfil:", error && error.code ? error.code : "error");
    document.getElementById("msgPerfil").innerText = error && error.message
      ? error.message
      : "No se pudo guardar el perfil.";
    return;
  }

  window.perfilSesionCompleto = true;
  const uid = auth.currentUser.uid;
  mostrarPantallaInicialUsuario(uid, datosPerfil).catch(function(error) {
    console.warn("No se pudo guardar el estado de la guia inicial:", error.message);
  });

  ejecutarTareasAuxiliaresRegistro(uid, userRef, fotosAnteriores);
}

function ejecutarTareasAuxiliaresRegistro(uid, userRef, fotosAnteriores) {
  const tareas = [
    iniciarPresenciaAvanzada(uid),
    userRef.collection("chatLeidos").doc("general").set({
      lastReadAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      tipo: "general",
      titulo: "General"
    }, { merge: true })
  ];

  (fotosAnteriores || []).forEach(function(url) {
    tareas.push(borrarImagenStorageSiProcede(url, ["usuarios/", "fotosPerfil/"]));
  });

  Promise.all(tareas.map(function(tarea) {
    return Promise.resolve(tarea).catch(function(error) {
      console.warn("Tarea auxiliar de registro pendiente:", error.message);
      return null;
    });
  })).catch(function() {});
}

async function guardarPerfilRegistro(boton) {
  const estadoBoton = bloquearBotonAccion(boton, "Guardando...");
  if (estadoBoton.bloqueado) return;
  const mensaje = document.getElementById("msgPerfil");
  if (mensaje) mensaje.innerText = "";

  try {
    await guardarPerfilRegistroInterno();
    if (!window.perfilSesionCompleto) restaurarBotonAccion(estadoBoton);
  } catch (error) {
    console.error("No se pudo completar el registro:", error && error.code ? error.code : "error");
    if (mensaje) {
      mensaje.innerText = error && error.message
        ? error.message
        : "No se pudo completar el registro.";
    }
    restaurarBotonAccion(estadoBoton);
  }
}


// ======================

async function mostrarPantallaInicialUsuario(uid, data) {
  if (!uid) {
    mostrar("menu");
    return;
  }

  if (data && data.guiaUsoVista === true) {
    mostrar("menu");
    return;
  }

  guiaUsoModoLegalRegistro = false;
  guiaUsoBloquePendiente = null;
  mostrar("instrucciones");

  try {
    await db.collection("usuarios").doc(uid).set({
      guiaUsoVista: true
    }, { merge: true });
  } catch (error) {
    console.warn("No se pudo marcar la guia de uso como vista:", error.message);
  }
}

function login(){

let emailInput = document.getElementById("email");
let passInput = document.getElementById("pass");

if(!emailInput || !passInput){
alert("Error: inputs no encontrados");
return;
}

let email = emailInput.value;
let pass = passInput.value;

auth.signInWithEmailAndPassword(email, pass)
  .catch(e => {
    console.warn("No se pudo iniciar sesion:", e && e.code ? e.code : "error");
    alert(e.message);
  });

}

async function logout(){
  actualizarVisibilidadBottomNav("login");

  if (typeof window.limpiarTodoChat === "function") {
    window.limpiarTodoChat();
  }

  const user = auth.currentUser;
  if (user) {
    const uid = user.uid;
    try {
      await detenerPresenciaAvanzada(uid, true);
    } catch (error) {
      console.warn("No se pudo marcar usuario offline:", error.message);
    }
  }

  auth.signOut();
}

auth.onAuthStateChanged(async user => {

  if (user) {

    const doc = await db.collection("usuarios").doc(user.uid).get();
    const data = doc.exists ? (doc.data() || {}) : {};

    if (doc.exists && Object.prototype.hasOwnProperty.call(data, "email")) {
      try {
        await doc.ref.update({
          email: firebase.firestore.FieldValue.delete()
        });
        delete data.email;
      } catch (error) {
        console.warn("No se pudo retirar el email legacy del perfil:", error && error.code ? error.code : "error");
      }
    }

    if (doc.exists && perfilUsuarioCompleto(data)) {

      window.perfilSesionCompleto = true;
      if (data.perfilCompleto !== true) {
        try {
          await doc.ref.set({
            perfilCompleto: true
          }, { merge: true });
        } catch (error) {
          console.warn("No se pudo marcar el perfil legacy como completo:", error.message);
        }
      }
      esAdmin = data && (data.admin === true || data.rol === "admin");
      actualizarBotonEstadisticasAdmin();

      try {
        await iniciarPresenciaAvanzada(user.uid);
      } catch (error) {
        console.error("[PRESENCIA] Fallo al activar presencia:", error && error.code ? error.code : error.message);
      }

      document.getElementById("saludo").innerText =
        "Hola " + (data.nombre || "");

      document.getElementById("seguidores").innerText =
        Array.isArray(data.seguidores) ? data.seguidores.length : 0;

      document.getElementById("seguidos").innerText =
        Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

      if (typeof window.iniciarListenersChatsPartidas === "function") {
        window.iniciarListenersChatsPartidas(user.uid);
      }

      if (typeof window.escucharNotificaciones === "function") {
        window.escucharNotificaciones(user.uid);
      }

      if (typeof window.asegurarRevisionAvisosPartidasProximas === "function") {
        window.asegurarRevisionAvisosPartidasProximas();
      }

      if (typeof window.mostrarAvisoPwaSiProcede === "function") {
        window.mostrarAvisoPwaSiProcede();
      }

      await mostrarPantallaInicialUsuario(user.uid, data);

    } else {
      window.perfilSesionCompleto = false;
      esAdmin = false;
      actualizarBotonEstadisticasAdmin();
      avisoNivelMostrado = false;
      mostrar("perfilCompletar");
    }

    return;
  }

  esAdmin = false;
  window.perfilSesionCompleto = false;
  actualizarBotonEstadisticasAdmin();
  revisionCancelaciones5hSesionUid = null;
  detenerPresenciaAvanzada(null, false);
  if (typeof window.limpiarTodoChat === "function") {
    window.limpiarTodoChat();
  }
  if (typeof window.limpiarListenersChat === "function") {
    window.limpiarListenersChat();
  }
  if (typeof window.detenerNotificacionesInternas === "function") {
    window.detenerNotificacionesInternas();
  }
  mostrar("login");

});

function cambiarFoto(){
  document.getElementById("inputFotoEditar").click();
}

function establecerBotonesFotoOcupados(ocupados) {
  const btnCambiar = document.getElementById("btnCambiarFoto");
  const btnEliminar = document.getElementById("btnEliminarFoto");
  if (btnCambiar) btnCambiar.disabled = ocupados;
  if (btnEliminar) btnEliminar.disabled = ocupados;
}

async function eliminarFotoPerfil(boton) {
  const estadoBoton = bloquearBotonAccion(boton, "Eliminando...");
  if (estadoBoton.bloqueado) return false;
  const user = auth.currentUser;
  if (!user) {
    restaurarBotonAccion(estadoBoton);
    return false;
  }

  establecerBotonesFotoOcupados(true);
  try {
    const docRef = db.collection("usuarios").doc(user.uid);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("No se encontro el perfil del usuario.");

    const data = doc.data() || {};
    const fotoDefault = obtenerImagenPerfilPorDefecto(data);
    const fotosAnteriores = obtenerFotosStorageUsuario(data);

    await docRef.update({
      fotoPerfil: fotoDefault,
      fotoUrl: firebase.firestore.FieldValue.delete(),
      photoURL: firebase.firestore.FieldValue.delete()
    });

    const imgEditar = document.getElementById("fotoPerfilEditar");
    const imgPerfil = document.getElementById("fotoPerfil");
    if (imgEditar) imgEditar.src = fotoDefault;
    if (imgPerfil) imgPerfil.src = fotoDefault;

    for (let i = 0; i < fotosAnteriores.length; i++) {
      await borrarImagenStorageSiProcede(fotosAnteriores[i], ["usuarios/", "fotosPerfil/"]);
    }
    return true;
  } catch (error) {
    console.error("No se pudo eliminar la foto de perfil:", error && error.code ? error.code : "error");
    alert(error && error.message ? error.message : "No se pudo eliminar la foto.");
    return false;
  } finally {
    establecerBotonesFotoOcupados(false);
    restaurarBotonAccion(estadoBoton);
  }
}

window.eliminarFotoPerfil = eliminarFotoPerfil;

const inputFotoGlobal = document.getElementById("inputFotoEditar");

if (inputFotoGlobal) {
  inputFotoGlobal.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return;

    const previewURL = URL.createObjectURL(file);

    const imgEditar = document.getElementById("fotoPerfilEditar");
    if (imgEditar) imgEditar.src = previewURL;

    const imgPerfil = document.getElementById("fotoPerfil");
    if (imgPerfil) imgPerfil.src = previewURL;

    let fotoAnterior = "";
    let fotoDefault = "imagen/hombre.jpeg";
    let fotosAnteriores = [];
    try {
      establecerBotonesFotoOcupados(true);
      const docRef = db.collection("usuarios").doc(user.uid);
      const doc = await docRef.get();
      const data = doc.exists ? (doc.data() || {}) : {};
      fotoAnterior = data.fotoPerfil || "";
      fotoDefault = obtenerImagenPerfilPorDefecto(data);
      fotosAnteriores = obtenerFotosStorageUsuario(data);

      const ruta = "usuarios/" + user.uid + "/foto_" + Date.now() + ".jpg";
      const url = await subirImagen(ruta, file, "perfil-edicion");

      try {
        await docRef.update({
          fotoPerfil: url,
          fotoUrl: firebase.firestore.FieldValue.delete(),
          photoURL: firebase.firestore.FieldValue.delete()
        });
      } catch (error) {
        await borrarImagenStorageSiProcede(url, ["usuarios/", "fotosPerfil/"]);
        throw error;
      }
      for (let i = 0; i < fotosAnteriores.length; i++) {
        await borrarImagenStorageSiProcede(fotosAnteriores[i], ["usuarios/", "fotosPerfil/"]);
      }
    } catch (error) {
      const fotoRestaurada = fotoAnterior || fotoDefault;
      if (imgEditar) imgEditar.src = fotoRestaurada;
      if (imgPerfil) imgPerfil.src = fotoRestaurada;
      alert(error && error.message ? error.message : "No se pudo cambiar la foto.");
    } finally {
      URL.revokeObjectURL(previewURL);
      e.target.value = "";
      establecerBotonesFotoOcupados(false);
    }

  });
}

function togglePass(){
  const input = document.getElementById("pass");
  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }
}



// ======================

function crearTextoClasificacion(texto, className) {
  const el = document.createElement("div");

  if (className) {
    el.className = className;
  }

  el.textContent = texto;

  return el;
}

function formatearMediaClasificacion(total, valoracionesRecibidas) {
  if (!valoracionesRecibidas || valoracionesRecibidas <= 0) return "-";
  const media = Number(total || 0) / valoracionesRecibidas;
  return media.toFixed(1);
}

function obtenerFotoClasificacion(data) {
  if (data.fotoPerfil) return data.fotoPerfil;

  const sexo = String(data.sexo || "").toLowerCase().trim();
  if (sexo === "femenino" || sexo === "mujer") return "imagen/mujer.jpeg";
  return "imagen/hombre.jpeg";
}

function crearEstrellasClasificacion(valor) {
  const contenedor = document.createElement("span");
  contenedor.className = "clasificacionEstrellas";

  const numero = Number(valor);
  const media = isNaN(numero) ? 0 : numero;

  for (let i = 1; i <= 5; i++) {
    const estrella = document.createElement("span");
    estrella.className = "clasificacionEstrella";

    if (media >= i) {
      estrella.textContent = "★";
      estrella.classList.add("llena");
    } else if (media >= i - 0.5) {
      estrella.textContent = "★";
      estrella.classList.add("media");
    } else {
      estrella.textContent = "★";
      estrella.classList.add("vacia");
    }

    contenedor.appendChild(estrella);
  }

  return contenedor;
}

function crearFilaValoracionClasificacion(nombre, valor) {
  const fila = document.createElement("div");
  fila.className = "clasificacionValoracion";

  const etiqueta = crearTextoClasificacion(nombre, "clasificacionValoracionNombre");
  const estrellas = crearEstrellasClasificacion(valor);
  const numero = crearTextoClasificacion(valor, "clasificacionValoracionNumero");

  fila.appendChild(etiqueta);
  fila.appendChild(estrellas);
  fila.appendChild(numero);

  return fila;
}

function crearDatoIconoClasificacion(src, texto, valor, className) {
  const fila = document.createElement("div");
  fila.className = "clasificacionDatoIconoFila " + className;

  const icono = document.createElement("img");
  icono.className = "clasificacionDatoIcono";
  icono.src = src;
  icono.alt = texto;

  const contenido = document.createElement("span");
  contenido.className = "clasificacionDatoTexto";
  contenido.textContent = texto + ": " + valor;

  fila.appendChild(icono);
  fila.appendChild(contenido);

  return fila;
}

function crearCardClasificacion(jugador, posicion) {
  const card = document.createElement("div");
  card.className = "clasificacionCard";

  const puesto = document.createElement("div");
  puesto.className = "clasificacionPuesto";

  if (posicion === 1 || posicion === 2 || posicion === 3) {
    const logoTop = document.createElement("img");
    logoTop.className = "clasificacionLogoTop";

    if (posicion === 1) {
      logoTop.src = "logo-oro.png";
    } else if (posicion === 2) {
      logoTop.src = "logo-plata.png";
    } else {
      logoTop.src = "logo-bronce.png";
    }

    logoTop.alt = "Puesto " + posicion;
    puesto.appendChild(logoTop);
  }

  const pos = crearTextoClasificacion(String(posicion), "clasificacionPos");
  puesto.appendChild(pos);

  const foto = document.createElement("img");
  foto.className = "clasificacionFoto";
  foto.src = jugador.foto;
  foto.alt = jugador.nombre;
  foto.loading = "lazy";
  foto.decoding = "async";

  const info = document.createElement("div");
  info.className = "clasificacionInfo";

  const nombre = crearTextoClasificacion(jugador.nombre, "clasificacionNombre");

  const reputacion = document.createElement("div");
  reputacion.className = "clasificacionInfoFila";
  reputacion.appendChild(crearTextoClasificacion("Reputación:", "clasificacionInfoEtiqueta"));
  reputacion.appendChild(crearTextoClasificacion(jugador.puntos + " pts", "clasificacionInfoValor"));

  const partidos = document.createElement("div");
  partidos.className = "clasificacionInfoFila";
  partidos.appendChild(crearTextoClasificacion("Partidos:", "clasificacionInfoEtiqueta"));
  partidos.appendChild(crearTextoClasificacion(String(jugador.partidos), "clasificacionInfoValor"));

  info.appendChild(nombre);
  info.appendChild(reputacion);
  info.appendChild(partidos);

  const stats = document.createElement("div");
  stats.className = "clasificacionStats";

  stats.appendChild(
    crearFilaValoracionClasificacion("Puntualidad", jugador.mediaPuntualidad)
  );

  stats.appendChild(
    crearFilaValoracionClasificacion("Actitud", jugador.mediaActitud)
  );

  stats.appendChild(
    crearFilaValoracionClasificacion("Compromiso", jugador.mediaCompromiso)
  );

  const datos = document.createElement("div");
  datos.className = "clasificacionDatos";

  datos.appendChild(
    crearDatoIconoClasificacion(
      "imagenes app/clasificacion/fiabilidad.png",
      "Fiabilidad",
      jugador.fiabilidad + "%",
      "fiabilidad"
    )
  );

  datos.appendChild(
    crearDatoIconoClasificacion(
      "imagenes app/clasificacion/abandono.png",
      "Abandonos",
      String(jugador.abandonos),
      "abandonos"
    )
  );

  datos.appendChild(
    crearDatoIconoClasificacion(
      "imagenes app/clasificacion/penalizacion.png",
      "Penalizaciones activas",
      String(jugador.penalizacionesActivas),
      "penalizaciones"
    )
  );

  card.appendChild(puesto);
  card.appendChild(foto);
  card.appendChild(info);
  card.appendChild(stats);
  card.appendChild(datos);

  return card;
}

function actualizarBottomNavActivo(seccion) {
  window.seccionActualApp = seccion;
  const botones = document.querySelectorAll("#bottomNav .bottomNavBtn");
  if (!botones.length) return;

  const mapaSeccion = {
    menu: "menu",
    partidas: "partidas",
    crearPartida: "partidas",
    buscarPartida: "partidas",
    perfil: "perfil",
    perfilEditar: "perfil",
    perfilSocial: "perfil",
    chat: "chat"
  };
  const activa = mapaSeccion[seccion] || "";

  botones.forEach(function(btn) {
    btn.classList.toggle("activo", btn.dataset.navSection === activa);
  });
}

window.actualizarBottomNavActivo = actualizarBottomNavActivo;

function seccionSinSesionBottomNav(seccion) {
  return seccion === "login" || seccion === "perfilCompletar" || seccion === "cargaInicial";
}

function actualizarVisibilidadBottomNav(seccion) {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;

  const usuarioAutenticado = typeof auth !== "undefined" && !!auth.currentUser;
  const visible = usuarioAutenticado && !seccionSinSesionBottomNav(seccion);
  nav.classList.toggle("bottomNavVisible", visible);
}

window.actualizarVisibilidadBottomNav = actualizarVisibilidadBottomNav;

function cargarClasificacionComunitaria() {
  const contenedor = document.getElementById("listaClasificacion");
  if (!contenedor) return;

  contenedor.replaceChildren(crearTextoClasificacion("Cargando..."));

  db.collection("usuarios").get()
    .then(function(snapshot) {
      const jugadores = [];
      const recalculosPendientes = [];

      snapshot.forEach(function(doc) {
        const data = doc.data() || {};
        if (!perfilUsuarioCompleto(data)) return;
        const c = data.clasificacion || {};
        const puntos = Number(c.puntos || 0);
        const partidos = Number(c.partidos || 0);
        const valoracionesRecibidas = Number(c.valoracionesRecibidas || 0);
        const abandonos = Number(c.abandonos || 0);
        const resumenPenalizaciones = resumenPenalizacionesFiabilidad(data.penalizaciones || []);
        const penalizacionesActivas = resumenPenalizaciones.penalizacionesActivas;
        const fiabilidad = resumenPenalizaciones.fiabilidad;
        const fiabilidadGuardada = c.fiabilidad === undefined || c.fiabilidad === null
          ? 100
          : Number(c.fiabilidad);
        const nombre = data.nombre || "Jugador";

        if (
          Number(c.penalizacionesActivas || 0) !== penalizacionesActivas ||
          fiabilidadGuardada !== fiabilidad
        ) {
          recalculosPendientes.push(doc.ref.update({
            "clasificacion.penalizacionesActivas": penalizacionesActivas,
            "clasificacion.fiabilidad": fiabilidad
          }).catch(function(error) {
            console.warn("No se pudo recalcular la fiabilidad de " + doc.id + ":", error.message);
          }));
        }

        jugadores.push({
          uid: doc.id,
          nombre: nombre,
          nombreOrden: normalizarTexto(nombre),
          foto: obtenerFotoClasificacion(data),
          puntos: puntos,
          partidos: partidos,
          abandonos: abandonos,
          penalizacionesActivas: penalizacionesActivas,
          fiabilidad: fiabilidad,
          mediaPuntualidad: formatearMediaClasificacion(c.puntualidadTotal, valoracionesRecibidas),
          mediaActitud: formatearMediaClasificacion(c.actitudTotal, valoracionesRecibidas),
          mediaCompromiso: formatearMediaClasificacion(c.compromisoTotal, valoracionesRecibidas)
        });
      });

      if (recalculosPendientes.length > 0) {
        Promise.all(recalculosPendientes).catch(function(error) {
          console.warn("No se pudieron guardar todos los recalculos de fiabilidad:", error.message);
        });
      }

      jugadores.sort(function(a, b) {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.partidos !== a.partidos) return b.partidos - a.partidos;
        return a.nombreOrden.localeCompare(b.nombreOrden);
      });

      if (jugadores.length === 0) {
        contenedor.replaceChildren(crearTextoClasificacion("No hay jugadores"));
        return;
      }

      const fragment = document.createDocumentFragment();
      jugadores.forEach(function(jugador, index) {
        fragment.appendChild(crearCardClasificacion(jugador, index + 1));
      });

      contenedor.replaceChildren(fragment);
    })
    .catch(function(error) {
      console.error("Error cargando clasificación:", error && error.code ? error.code : "error");
      contenedor.replaceChildren(crearTextoClasificacion("No se pudo cargar la clasificación"));
    });
}

function mostrar(seccion){
  if (
    auth.currentUser &&
    window.perfilSesionCompleto !== true &&
    !["perfilCompletar", "testNivel", "login"].includes(seccion)
  ) {
    seccion = "perfilCompletar";
  }
  const cargaInicial = document.getElementById("pantallaCargaInicial");
  if (cargaInicial) cargaInicial.style.display = "none";

  const perfilVisible = ["perfil", "perfilEditar", "perfilSocial"].some(function(id) {
    const el = document.getElementById(id);
    return el && el.style.display !== "none";
  });
  const destinoPerfil = seccion === "perfil" || seccion === "perfilEditar" || seccion === "perfilSocial";
  if (perfilVisible && !destinoPerfil && typeof window.limpiarListenersPerfil === "function") {
    window.limpiarListenersPerfil();
  }

  const pistasPantalla = document.getElementById("pistas");
  const pistasVisible = pistasPantalla && pistasPantalla.style.display !== "none";
  if (pistasVisible && seccion !== "pistas" && typeof window.limpiarListenerPistas === "function") {
    window.limpiarListenerPistas();
  }

  actualizarVisibilidadBottomNav(seccion);
  actualizarBottomNavActivo(seccion);
  const abriendoChat = seccion === "chat";
  const chatPantalla = document.getElementById("chat");
  const saliendoChat = !abriendoChat && (
    document.body.classList.contains("chatAbierto") ||
    (chatPantalla && chatPantalla.style.display !== "none")
  );

  if (saliendoChat && typeof window.limpiarListenersChat === "function") {
    window.limpiarListenersChat();
  }

  document.body.classList.toggle("chatAbierto", abriendoChat);
  if (chatPantalla) {
    chatPantalla.classList.toggle("chatFullscreen", abriendoChat);
  }

  if (abriendoChat && typeof window.notificarEntradaSeccionChat === "function") {
    window.notificarEntradaSeccionChat();
  }

  const btnFoto = document.getElementById("btnCambiarFoto");
  if (btnFoto) btnFoto.style.display = "none";

  const secciones = [
    "login",
    "menu",
    "perfilCompletar",
    "perfil",
    "perfilEditar",
    "perfilSocial",
    "jugadores",
    "pistas",
    "editarPista",
    "testNivel",
    "crearPista",
    "chat",
    "instrucciones",
    "partidas",
    "crearPartida",
    "buscarPartida",
    "clasificacion",
    "estadisticas"
  ];

  secciones.forEach(function(id){
    const el = document.getElementById(id);
    if (el){
      el.style.display = "none";
    }
  });

  const actual = document.getElementById(seccion);
  if (actual){
    actual.style.display = "block";
  }

  if (abriendoChat && chatPantalla) {
    requestAnimationFrame(function() {
      const layout = chatPantalla.querySelector(".chatLayout");
      const main = chatPantalla.querySelector(".chatMain");
      const messages = chatPantalla.querySelector(".chatMessages");
      const composer = chatPantalla.querySelector(".chatComposer");

      
    });
  }

  if (seccion === "crearPartida") {

  const tipoNivel = document.getElementById("nivelTipo");
  const rango = document.getElementById("nivelRango");
  const desde = document.getElementById("nivelDesde");
  const hasta = document.getElementById("nivelHasta");

  // mostrar / ocultar rango
  if (tipoNivel && rango) {
    tipoNivel.onchange = function () {
      rango.style.display = this.value === "rango" ? "block" : "none";
    };
  }

  // generar niveles solo una vez
  if (desde && hasta && desde.options.length === 0) {

    const opcionDesde = document.createElement("option");
    opcionDesde.value = "";
    opcionDesde.textContent = "Desde";
    desde.appendChild(opcionDesde);
    let htmlDesde = '<option value="">Desde</option>';
    let htmlHasta = '<option value="">Hasta</option>';

    const opcionHasta = document.createElement("option");
    opcionHasta.value = "";
    opcionHasta.textContent = "Hasta";
    hasta.appendChild(opcionHasta);

    for (let i = 0.5; i <= 7; i += 0.25) {
      let val = Math.round(i * 100) / 100;
      const optDesde = document.createElement("option");
      optDesde.value = String(val);
      optDesde.textContent = String(val);
      desde.appendChild(optDesde);
      htmlDesde += '<option value="' + val + '">' + val + '</option>';
      htmlHasta += '<option value="' + val + '">' + val + '</option>';

      const optHasta = document.createElement("option");
      optHasta.value = String(val);
      optHasta.textContent = String(val);
      hasta.appendChild(optHasta);
    }
    desde.innerHTML = htmlDesde;
    hasta.innerHTML = htmlHasta;
  }

 }

if (seccion === "pistas"){
  cargarPistas();
}

if (seccion === "estadisticas" && typeof window.cargarEstadisticas === "function") {
  window.cargarEstadisticas();
}

if (seccion === "crearPartida") {
  initCrearPartida();
}

if (seccion === "partidas") {
  
if (!window.vieneDeBusqueda) {
  delete window.filtrosPartidas;
}

window.vieneDeBusqueda = false;

cambiarModoPartidas("proximas");
}

if (seccion === "buscarPartida") {

  if (typeof window.resetearBusquedaPartidas === "function") {
    window.resetearBusquedaPartidas();
  } else {
    delete window.filtrosPartidas;
  }
}

if (seccion === "clasificacion") {
  cargarClasificacionComunitaria();
}

if (seccion === "instrucciones") {
  cargarGuiaUso();
}

  const btnNueva = document.getElementById("btnNuevaPista");

if (btnNueva) {
  btnNueva.style.display = window.modoSeleccionPista ? "none" : "inline-block";
}
}

const documentosGuiaUso = [
  {
    titulo: "Cómo funcionan las partidas",
    archivo: "guia%20de%20uso/1.Partidas.txt"
  },
  {
    titulo: "Reservas y sustituciones",
    archivo: "guia%20de%20uso/2.Reservas_y_Sustituciones.txt"
  },
  {
    titulo: "Partidas amistosas",
    archivo: "guia%20de%20uso/3.Partidas_Amistosas.txt"
  },
  {
    titulo: "Partidas ranking",
    archivo: "guia%20de%20uso/4.Partidas_Ranking.txt"
  },
  {
    titulo: "Incidencia de no presentado",
    archivo: "guia%20de%20uso/5.Incidencia_No_Presentado.txt"
  },
  {
    titulo: "Reputación y clasificación",
    archivo: "guia%20de%20uso/6.Reputacion_y_Clasificacion.txt"
  },
  {
    titulo: "Penalizaciones y fiabilidad",
    archivo: "guia%20de%20uso/7.Penalizaciones_y_Fiabilidad.txt"
  },
  {
    titulo: "Chat",
    archivo: "guia%20de%20uso/8.Chat.txt"
  },
  {
    titulo: "Logros",
    archivo: "guia%20de%20uso/9.Logros.txt"
  },
  {
    titulo: "Pistas",
    archivo: "guia%20de%20uso/10.Pistas.txt"
  },
  {
    titulo: "Contacto y sugerencias",
    archivo: "guia%20de%20uso/11.Contacto_y_Sugerencias.txt"
  },
  {
    titulo: "Notificaciones",
    archivo: "guia%20de%20uso/12.Notificaciones.txt"
  },
  {
    titulo: "Aviso Legal, Términos y Condiciones de Uso y Política de Privacidad",
    archivo: "guia%20de%20uso/13.Aviso_Legal_Terminos_Condiciones_y_Privacidad.txt"
  }
];

let guiaUsoBloquePendiente = null;
let guiaUsoModoLegalRegistro = false;

function cargarGuiaUso() {
  const contenedor = document.getElementById("guiaUsoLista");
  if (!contenedor) return;
  const documentos = guiaUsoModoLegalRegistro
    ? [documentosGuiaUso[12]]
    : documentosGuiaUso;

  contenedor.textContent = "Cargando Guía de Uso...";

  Promise.all(documentos.map(function(documento) {
    return fetch(documento.archivo, { cache: "no-cache" })
      .then(function(respuesta) {
        if (!respuesta.ok) {
          throw new Error("No se pudo cargar " + documento.archivo);
        }
        return respuesta.text();
      })
      .then(function(texto) {
        return {
          titulo: documento.titulo,
          texto: texto
        };
      });
  }))
    .then(function(documentos) {
      const fragment = document.createDocumentFragment();

      documentos.forEach(function(documento, indice) {
        const abierto = guiaUsoModoLegalRegistro || indice === 0;
        const bloque = document.createElement("section");
        bloque.className = abierto ? "guiaUsoBloque abierto" : "guiaUsoBloque";
        bloque.dataset.guiaUsoIndice = String(guiaUsoModoLegalRegistro ? 12 : indice);

        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "guiaUsoTitulo";
        boton.setAttribute("aria-expanded", abierto ? "true" : "false");

        const flecha = document.createElement("span");
        flecha.className = "guiaUsoFlecha";
        flecha.textContent = abierto ? "▼" : "▶";

        const titulo = document.createElement("span");
        titulo.textContent = documento.titulo;

        const contenido = document.createElement("div");
        contenido.className = "guiaUsoContenido";
        contenido.appendChild(formatearContenidoGuiaUso(documento.texto));

        boton.append(flecha, titulo);
        boton.addEventListener("click", function() {
          alternarBloqueGuiaUso(bloque, boton, flecha);
        });

        bloque.append(boton, contenido);
        fragment.appendChild(bloque);
      });

      contenedor.replaceChildren(fragment);

      if (guiaUsoBloquePendiente !== null) {
        abrirBloqueGuiaUsoPorIndice(guiaUsoBloquePendiente);
        guiaUsoBloquePendiente = null;
      }
    })
    .catch(function(error) {
      console.error("Error cargando Guía de Uso:", error && error.code ? error.code : "error");
      contenedor.textContent = "No se pudo cargar la Guía de Uso.";
    });
}

function alternarBloqueGuiaUso(bloque, boton, flecha) {
  const abierto = bloque.classList.toggle("abierto");
  boton.setAttribute("aria-expanded", abierto ? "true" : "false");
  flecha.textContent = abierto ? "▼" : "▶";
}

function abrirAvisoLegalGuiaUso(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  guiaUsoModoLegalRegistro = true;
  guiaUsoBloquePendiente = null;
  mostrar("instrucciones");
}

function abrirGuiaUsoNormal() {
  guiaUsoModoLegalRegistro = false;
  guiaUsoBloquePendiente = null;
  mostrar("instrucciones");
}

function volverGuiaUso() {
  if (guiaUsoModoLegalRegistro) {
    guiaUsoModoLegalRegistro = false;
    guiaUsoBloquePendiente = null;
    mostrar("login");
    return;
  }

  mostrar("menu");
}

function abrirBloqueGuiaUsoPorIndice(indice) {
  const bloques = document.querySelectorAll("#guiaUsoLista .guiaUsoBloque");
  let bloqueDestino = null;

  bloques.forEach(function(bloque) {
    const esDestino = Number(bloque.dataset.guiaUsoIndice) === indice;
    const boton = bloque.querySelector(".guiaUsoTitulo");
    const flecha = bloque.querySelector(".guiaUsoFlecha");

    bloque.classList.toggle("abierto", esDestino);

    if (boton) {
      boton.setAttribute("aria-expanded", esDestino ? "true" : "false");
    }

    if (flecha) {
      flecha.textContent = esDestino ? "▼" : "▶";
    }

    if (esDestino) {
      bloqueDestino = bloque;
    }
  });

  if (bloqueDestino) {
    setTimeout(function() {
      bloqueDestino.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }
}

function formatearContenidoGuiaUso(texto) {
  const fragment = document.createDocumentFragment();
  const lineas = texto.split(/\r?\n/);
  let tituloPrincipalAplicado = false;

  lineas.forEach(function(linea) {
    const elemento = document.createElement("div");
    const textoLinea = linea.trim();

    if (!textoLinea) {
      elemento.className = "guiaUsoLineaVacia";
    } else if (!tituloPrincipalAplicado) {
      elemento.className = "guiaUsoTituloPrincipal";
      elemento.textContent = linea;
      tituloPrincipalAplicado = true;
    } else if (/^\d+\.\s+/.test(textoLinea)) {
      elemento.className = "guiaUsoApartado";
      elemento.textContent = linea;
    } else if (esBloqueEspecialGuiaUso(textoLinea)) {
      elemento.className = "guiaUsoBloqueEspecial";
      elemento.textContent = linea;
    } else {
      elemento.className = "guiaUsoTexto";
      elemento.textContent = linea;
    }

    fragment.appendChild(elemento);
  });

  return fragment;
}

function esBloqueEspecialGuiaUso(texto) {
  if (texto.length > 60) return false;
  if (/^\d+\./.test(texto)) return false;
  return texto === texto.toUpperCase() && /[A-ZÁÉÍÓÚÜÑ]/.test(texto);
}

function abrirTest(){
  alert("Elige bien tu nivel. No podrás cambiarlo después.");
  
  ("testNivel");
}

