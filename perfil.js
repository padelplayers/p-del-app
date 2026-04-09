let unsubscribePerfil = null;
let unsubscribeUser = null;

function eliminarPerfil() {

  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;

  // limpiar referencias en otros usuarios
db.collection("usuarios").get().then(snapshot => {
  snapshot.forEach(doc => {
    const data = doc.data();

    if (data.siguiendo && data.siguiendo.includes(uid)) {
      db.collection("usuarios").doc(doc.id).update({
        siguiendo: data.siguiendo.filter(id => id !== uid)
      });
    }

    if (data.seguidores && data.seguidores.includes(uid)) {
      db.collection("usuarios").doc(doc.id).update({
        seguidores: data.seguidores.filter(id => id !== uid)
      });
    }
  });
});

// borrar de Firestore
db.collection("usuarios").doc(uid).delete()

    .then(() => {
      // borrar usuario de Auth
      return user.delete();
    })

    .then(() => {
      alert("Perfil eliminado");
      mostrar("login");
    })

    .catch((error) => {
      console.error(error);

      if (error.code === "auth/requires-recent-login") {
        alert("Vuelve a iniciar sesión para eliminar la cuenta");
      }
    });
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
    document.getElementById("fotoPerfil").src = data.fotoPerfil || "imagen/hombre.jpeg";

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


  const user = auth.currentUser;
  if (!user) return;

  const mano = document.getElementById("mano");
const posicion = document.getElementById("posicion");

if (mano) mano.disabled = false;
if (posicion) posicion.disabled = false;

  const docRef = db.collection("usuarios").doc(user.uid);

docRef.get().then(doc => {
  if (!doc.exists) return;

  const data = doc.data();

  const mano = document.getElementById("mano");
  const posicion = document.getElementById("posicion");

  if (mano) mano.value = data.mano || "";
  if (posicion) posicion.value = data.posicion || "";
});

  mostrar("perfilEditar");

  document.getElementById("btnCambiarFoto").style.display = "block";

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
    if (user) {

      unsubscribePerfil && unsubscribePerfil();

      unsubscribePerfil = db.collection("usuarios")
        .doc(user.uid)
        .onSnapshot(doc => {

          if (!doc.exists) return;

          const data = doc.data();

          document.getElementById("nombrePerfil").innerText = data.nombre || "";
          document.getElementById("nivelPerfil").innerText = (data.nivel || 0) + " nivel";
          document.getElementById("fotoPerfil").src = data.fotoPerfil || "imagen/hombre.jpeg";

          document.getElementById("seguidores").innerText =
            Array.isArray(data.seguidores) ? data.seguidores.length : 0;

          document.getElementById("seguidos").innerText =
            Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

        });
    }
  }

}

function guardarPerfil(){

  document.getElementById("btnCambiarFoto").style.display = "none";

  console.log("CLICK GUARDAR");

  const user = auth.currentUser;
  if (!user) {
    console.log("NO USER");
    return;
  }

  const manoEl = document.getElementById("manoEditar");
  const posicionEl = document.getElementById("posicionEditar");




  console.log("ELEMENTOS:", manoEl, posicionEl);

  if (!manoEl || !posicionEl) {
    console.log("ERROR: no encuentra selects");
    return;
  }

  


 const mano = manoEl.value;
const posicion = posicionEl.value;


  console.log("VALORES:", mano, posicion);



  if (!mano || !posicion) return

  db.collection("usuarios").doc(user.uid).update({
    mano: mano,
    posicion: posicion
  })
  .then(() => {
    console.log("GUARDADO OK");
    unsubscribePerfil && unsubscribePerfil();
    cargarPerfil(user.uid);
    mostrar("perfil");

  })
  .catch(err => {
    console.error("ERROR GUARDANDO:", err);
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
     document.getElementById("partidos").innerText = data.partidos || 0;
document.getElementById("seguidores").innerText = data.seguidores ? data.seguidores.length : 0;
document.getElementById("seguidos").innerText = data.siguiendo ? data.siguiendo.length : 0;
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