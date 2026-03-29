function verPerfil(uid){

  // cambiar vista inmediatamente
  mostrar("perfil");

  const user = auth.currentUser;

  const btn = document.getElementById("btnSeguir");

if (user.uid === uid) {
  btn.style.display = "none";
} else {
  btn.style.display = "block";
}

  db.collection("usuarios").doc(uid).get().then(doc => {

    if (!doc.exists) return;

    const data = doc.data();

    // guardar UID activo
    document.getElementById("perfil").dataset.uid = uid;

    // render básico
    document.getElementById("nombrePerfil").innerText = data.nombre || "";
    document.getElementById("nivelPerfil").innerText = (data.nivel || 0) + " nivel";
    document.getElementById("fotoPerfil").src = data.fotoPerfil || "imagen/hombre.jpeg";

    // seguidores
    document.getElementById("seguidores").innerText =
      Array.isArray(data.seguidores) ? data.seguidores.length : 0;
      document.getElementById("seguidos").innerText =
  Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;


    // lógica seguir
    db.collection("usuarios").doc(user.uid).get().then(miDoc => {

      const siguiendo = (miDoc.data()?.siguiendo) || [];
      const sigo = siguiendo.includes(uid);

      const btnSeguir = document.getElementById("btnSeguir");
      const botones = document.querySelector(".perfil-botones");

      const editarBtn = botones.children[0];
const eliminarBtn = botones.children[2];


     if (uid === user.uid) {
  btnSeguir.style.display = "none";
  editarBtn.style.display = "block";
  eliminarBtn.style.display = "block";
} else {
  btnSeguir.style.display = "block";
  editarBtn.style.display = "none";
  eliminarBtn.style.display = "none";
}

    });

  });

}

function toggleSeguir(){

  const user = auth.currentUser;
  const uid = document.getElementById("perfil").dataset.uid;

  const miRef = db.collection("usuarios").doc(user.uid);
  const otroRef = db.collection("usuarios").doc(uid);

  miRef.get().then(miDoc => {

    const sigo = ((miDoc.data() && miDoc.data().siguiendo) || []).includes(uid);

    let promesas = [];

    if (sigo) {

      promesas.push(
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayRemove(uid)
        })
      );

      promesas.push(
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayRemove(user.uid)
        })
      );

    } else {

      promesas.push(
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayUnion(uid)
        })
      );

      promesas.push(
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
        })
      );

    }

   Promise.all(promesas).then(async () => {


      const btn = document.getElementById("btnSeguir");
      btn.innerText = sigo ? "Dejar de seguir" : "Seguir";

      await new Promise(r => setTimeout(r, 100));
verPerfil(uid);

    });

  });

}