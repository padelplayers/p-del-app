let unsubscribePerfil = null;
let unsubscribeUser = null;

function verPerfil(uid){

  // cancelar listeners anteriores
  if (unsubscribePerfil) unsubscribePerfil();
  if (unsubscribeUser) unsubscribeUser();

  mostrar("perfil");

  const user = auth.currentUser;

if (!user) return;

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

  if (!btnSeguir) return;

  btnSeguir.onclick = toggleSeguir;


  document.getElementById("perfil").dataset.uid = uid;


  

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

    if (!miDoc.exists) return;

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";

    btnSeguir.classList.toggle("btnYellow", !sigo);

  });

  

}


function toggleSeguir(){

  const btnSeguir = document.getElementById("btnSeguir");
btnSeguir.disabled = true;

  const user = auth.currentUser;
  const uid = document.getElementById("perfil").dataset.uid;

  const miRef = db.collection("usuarios").doc(user.uid);
  const otroRef = db.collection("usuarios").doc(uid);

return miRef.get().then(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    if (sigo) {

  return Promise.all([
    miRef.update({
      siguiendo: firebase.firestore.FieldValue.arrayRemove(uid)
    }),
    otroRef.update({
      seguidores: firebase.firestore.FieldValue.arrayRemove(user.uid)
    })
  ]).then(() => {
    btnSeguir.disabled = false;
  }).catch(() => {
    btnSeguir.disabled = false;
  });

} else {

  return Promise.all([
    miRef.update({
      siguiendo: firebase.firestore.FieldValue.arrayUnion(uid)
    }),
    otroRef.update({
      seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
    })
  ]).then(() => {
    btnSeguir.disabled = false;
  }).catch(() => {
    btnSeguir.disabled = false;
  });

}

});