let unsubscribePerfil = null;
let unsubscribeUser = null;

function verPerfil(uid){

  // cancelar listeners anteriores
  if (unsubscribePerfil) unsubscribePerfil();
  if (unsubscribeUser) unsubscribeUser();

  mostrar("perfil");

  const user = auth.currentUser;
  document.getElementById("perfil").dataset.uid = uid;

  const uidActual = uid;

  if (user.uid === uidActual) {

  btnSeguir.style.display = "none";
  editarBtn.style.display = "block";
  eliminarBtn.style.display = "block";
} else {
  btnSeguir.style.display = "block";
  editarBtn.style.display = "none";
  eliminarBtn.style.display = "none";
}

  const btnSeguir = document.getElementById("btnSeguir");

  // LISTENER PERFIL (seguidores en tiempo real)
  unsubscribePerfil = db.collection("usuarios").doc(uid).onSnapshot(doc => {

    if (!doc.exists) return;

    const data = doc.data();

    const editarBtn = document.getElementById("btnEditar");
const eliminarBtn = document.getElementById("btnEliminar");

const uidActual = document.getElementById("perfil").dataset.uid;



    document.getElementById("nombrePerfil").innerText = data.nombre || "";
    document.getElementById("nivelPerfil").innerText = (data.nivel || 0) + " nivel";
    document.getElementById("fotoPerfil").src = data.fotoPerfil || "imagen/hombre.jpeg";

    document.getElementById("seguidores").innerText =
      Array.isArray(data.seguidores) ? data.seguidores.length : 0;

    document.getElementById("seguidos").innerText =
      Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

  });

  // LISTENER USUARIO (estado seguir en tiempo real)
  unsubscribeUser = db.collection("usuarios").doc(user.uid).onSnapshot(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";

  });

  

}


function toggleSeguir(){

  const user = auth.currentUser;
  const uid = document.getElementById("perfil").dataset.uid;

  const miRef = db.collection("usuarios").doc(user.uid);
  const otroRef = db.collection("usuarios").doc(uid);

  miRef.get().then(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    if (sigo) {

      miRef.update({
        siguiendo: firebase.firestore.FieldValue.arrayRemove(uid)
      });

      otroRef.update({
        seguidores: firebase.firestore.FieldValue.arrayRemove(user.uid)
      });

    } else {

      miRef.update({
        siguiendo: firebase.firestore.FieldValue.arrayUnion(uid)
      });

      otroRef.update({
        seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
      });

    }

  });

}