let unsubscribePerfil = null;
let unsubscribeUser = null;

async function eliminarPerfil() {

  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;

  try {

    // 1. limpiar referencias
    const snapshot = await db.collection("usuarios").get();

    const updates = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      if (data.siguiendo && data.siguiendo.includes(uid)) {
        updates.push(
          db.collection("usuarios").doc(doc.id).update({
            siguiendo: data.siguiendo.filter(id => id !== uid)
          })
        );
      }

      if (data.seguidores && data.seguidores.includes(uid)) {
        updates.push(
          db.collection("usuarios").doc(doc.id).update({
            seguidores: data.seguidores.filter(id => id !== uid)
          })
        );
      }
    });

    await Promise.all(updates);

    // 2. borrar Firestore
    await db.collection("usuarios").doc(uid).delete();

    // 3. borrar Auth
    await user.delete();

    alert("Perfil eliminado");
    mostrar("login");

  } catch (error) {

    console.error(error);

    if (error.code === "auth/requires-recent-login") {
      alert("Vuelve a iniciar sesión para eliminar la cuenta");
      await auth.signOut();
    }

  }
}

function verPerfil(uid = auth.currentUser?.uid){

  document.getElementById("btnCambiarFoto").style.display = "none";

  const user = auth.currentUser;
  if (!user || !uid) return;

  // limpiar listeners anteriores
  if (unsubscribePerfil) unsubscribePerfil();
  if (unsubscribeUser) unsubscribeUser();

  mostrar("perfil");

  // guardar uid activo
  const perfilEl = document.getElementById("perfil");
  if (perfilEl) perfilEl.dataset.uid = uid;

  const btnSeguir = document.getElementById("btnSeguir");
  const editarBtn = document.getElementById("btnEditar");
  const eliminarBtn = document.getElementById("btnEliminar");

  // control botones
  if (editarBtn) editarBtn.style.display = (user.uid === uid) ? "block" : "none";
  if (eliminarBtn) eliminarBtn.style.display = (user.uid === uid) ? "block" : "none";
  if (btnSeguir) {
    btnSeguir.style.display = (user.uid !== uid) ? "block" : "none";
    btnSeguir.onclick = toggleSeguir;
  }

  if (btnSeguir && user.uid !== uid) {
  db.collection("usuarios").doc(user.uid).get().then(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];

    if (siguiendo.includes(uid)) {
      btnSeguir.innerText = "Dejar de seguir";
      btnSeguir.classList.remove("btnSeguir");
      btnSeguir.classList.add("btnSiguiendo");
    } else {
      btnSeguir.innerText = "Seguir";
      btnSeguir.classList.remove("btnSiguiendo");
      btnSeguir.classList.add("btnSeguir");
    }

  });
}

  // LISTENER PERFIL
  unsubscribePerfil = db.collection("usuarios").doc(uid).onSnapshot(doc => {

if (!doc.exists) {
  console.log("NO EXISTE DOC");
  return;
}

const data = doc.data();
console.log("DATA:", data);

    const manoSelect = document.getElementById("manoEditar");
const posicionSelect = document.getElementById("posicionEditar");

if (manoSelect && data.mano) manoSelect.value = data.mano;
if (posicionSelect && data.posicion) posicionSelect.value = data.posicion;

  


    document.getElementById("nombrePerfil").innerText = data.nombre || "";
    document.getElementById("nivelPerfil").innerText = (data.nivel || 0) + " nivel";
    document.getElementById("manoPerfil").innerText = data.mano || "-";
    document.getElementById("posicionPerfil").innerText = data.posicion || "-";
    console.log("FOTO PERFIL:", data.fotoPerfil);
    document.getElementById("fotoPerfil").src =
  data.fotoPerfil && data.fotoPerfil.startsWith("http")
    ? data.fotoPerfil
    : (data.sexo === "mujer" ? "imagen/mujer.jpeg" : "imagen/hombre.jpeg");

    document.getElementById("seguidores").innerText =
      Array.isArray(data.seguidores) ? data.seguidores.length : 0;

    document.getElementById("seguidos").innerText =
      Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

  });

  // LISTENER USUARIO (estado seguir)
  unsubscribeUser = db.collection("usuarios").doc(user.uid).onSnapshot(miDoc => {

    if (!miDoc.exists) return;

    const perfilActual = document.getElementById("perfil").dataset.uid;
    if (!perfilActual) return;

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(perfilActual);

    if (btnSeguir) {
      btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";
      btnSeguir.classList.toggle("btnYellow", !sigo);
    }

  });

}

function editarPerfil(){

  if (typeof unsubscribePerfil === "function") unsubscribePerfil();


  const user = auth.currentUser;
  if (!user) return;

  const imgEditar = document.getElementById("fotoPerfilEditar");

if (imgEditar && auth.currentUser) {
  db.collection("usuarios").doc(auth.currentUser.uid).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();

      let defaultImg = data.sexo === "mujer"
        ? "imagen/mujer.jpeg"
        : "imagen/hombre.jpeg";

      imgEditar.src = (data.fotoPerfil || defaultImg) + "?t=" + Date.now();
    }
  });
}

  mostrar("perfilEditar");

  const manoEl = document.getElementById("mano");
  const posicionEl = document.getElementById("posicion");

  if (manoEl) manoEl.disabled = false;
  if (posicionEl) posicionEl.disabled = false;

  const btnFoto = document.getElementById("btnCambiarFoto");
  if (btnFoto) btnFoto.style.display = "block";

  // ESCUCHA EN TIEMPO REAL (igual que perfil)
  db.collection("usuarios").doc(user.uid)
    .onSnapshot(doc => {

      if (!doc.exists) return;

      const data = doc.data();

      const foto = document.getElementById("fotoPerfilEditar");
      if (foto) foto.src = data.fotoPerfil || "imagen/hombre.jpeg";

      if (manoEl) manoEl.value = data.mano || "";
      if (posicionEl) posicionEl.value = data.posicion || "";

    });

}


function toggleSeguir(){

 

  const btnSeguir = document.getElementById("btnSeguir");
  if (btnSeguir) btnSeguir.disabled = true;

  const user = auth.currentUser;
  if (!user) return;

  const uid = document.getElementById("perfil").dataset.uid;

  const miRef = db.collection("usuarios").doc(user.uid);
  const otroRef = db.collection("usuarios").doc(uid);

  return miRef.get().then(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    if (btnSeguir) {
  if (!sigo) {
  // vas a empezar a seguir
  btnSeguir.innerText = "Dejar de seguir";
  btnSeguir.classList.remove("btnSeguir");
  btnSeguir.classList.add("btnSiguiendo");
} else {
  // vas a dejar de seguir
  btnSeguir.innerText = "Seguir";
  btnSeguir.classList.remove("btnSiguiendo");
  btnSeguir.classList.add("btnSeguir");
}
}

    if (sigo) {

      return Promise.all([
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayRemove(uid)
        }),
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayRemove(user.uid)
        })
      ]);

    } else {

      return Promise.all([
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayUnion(uid)
        }),
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
        })
      ]);

    }

  }).finally(() => {
    if (btnSeguir) btnSeguir.disabled = false;
  });

}

function mostrar(seccion){

  document.getElementById("login").style.display = "none";
  document.getElementById("menu").style.display = "none";
  document.getElementById("perfilCompletar").style.display = "none";
  document.getElementById("perfil").style.display = "none";
  document.getElementById("jugadores").style.display = "none";

  const editar = document.getElementById("perfilEditar");
  if (editar) editar.style.display = "none";

  document.getElementById(seccion).style.display = "block";

  // CARGAR PERFIL
  if (seccion === "perfil") {

    const user = auth.currentUser;
    if (!user) return;

    if (typeof unsubscribePerfil === "function") unsubscribePerfil();

    unsubscribePerfil = db.collection("usuarios")
      .doc(user.uid)
      .onSnapshot({ includeMetadataChanges: true }, doc => {

  if (doc.metadata.hasPendingWrites) return;

  if (!doc.exists) return;

        const data = doc.data();

        console.log("DATA PERFIL:", data);

        console.log("ELEMENTOS:",
          document.getElementById("nombrePerfil"),
          document.getElementById("nivelPerfil"),
          document.getElementById("fotoPerfil")
        );

        // NO actualizar si estás en editar perfil
        const pantalla = document.getElementById("perfilEditar");
        if (pantalla && pantalla.style.display === "block") return;

        const nombre = document.getElementById("nombrePerfil");
        if (nombre) nombre.innerText = data.nombre || "";

        const nivel = document.getElementById("nivelPerfil");
        if (nivel) nivel.innerText = (data.nivel || 0) + " nivel";

        const foto = document.getElementById("fotoPerfil");
        if (foto) foto.src = data.fotoPerfil || "imagen/hombre.jpeg";

        const seguidores = document.getElementById("seguidores");
        if (seguidores) {
          seguidores.innerText = Array.isArray(data.seguidores) ? data.seguidores.length : 0;
        }

        const seguidos = document.getElementById("seguidos");
        if (seguidos) {
          seguidos.innerText = Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;
        }

      });
  }

}

function guardarPerfil(){

  console.log("CLICK GUARDAR");

  const user = auth.currentUser;
  if (!user) return;

  const manoEl = document.getElementById("manoEditar");
  const posicionEl = document.getElementById("posicionEditar");

  if (!manoEl || !posicionEl) return;

  const mano = manoEl.value;
  const posicion = posicionEl.value;

  if (!mano || !posicion) return;

  db.collection("usuarios").doc(user.uid).update({
    mano: mano,
    posicion: posicion
  })
  .then(() => {

    mostrar("perfil");

  })
  .catch(err => {
    console.error(err);
  });

}


function cargarPerfil(uid){

  unsubscribePerfil && unsubscribePerfil();

  unsubscribePerfil = db.collection("usuarios")
    .doc(uid)
    .onSnapshot(doc => {

      if (!doc.exists) return;

      const data = doc.data();

      document.getElementById("nombrePerfil").innerText = data.nombre || "";
      document.getElementById("nivelPerfil").innerText = (data.nivel || 0) + " nivel";
      document.getElementById("fotoPerfil").src = data.fotoPerfil || "imagen/hombre.jpeg";

      document.getElementById("manoPerfil").innerText = data.mano || "-";
      document.getElementById("posicionPerfil").innerText = data.posicion || "-";

      const elPartidos = document.getElementById("partidos");
      if (elPartidos) elPartidos.innerText = data.partidos || 0;

      const elSeguidores = document.getElementById("seguidores");
      if (elSeguidores) elSeguidores.innerText = data.seguidores || 0;

      const elSeguidos = document.getElementById("seguidos");
      if (elSeguidos) elSeguidos.innerText = data.seguidos || 0;

      const manoSelect = document.getElementById("manoEditar");
      const posicionSelect = document.getElementById("posicionEditar");

      if (manoSelect && data.mano) manoSelect.value = data.mano;
      if (posicionSelect && data.posicion) posicionSelect.value = data.posicion;

    });
}


function irPerfil(){
  const user = auth.currentUser;
  if (!user) return;

  mostrar("perfil");
  cargarPerfil(user.uid);
}