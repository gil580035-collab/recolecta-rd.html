// admin.js - Panel de Administración RECOLECTA-RD

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let adminUser = null;

// Detectar estado del admin
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  adminUser = user;

  // Verificar si ES ADMIN
  const userDoc = await db.collection("users").doc(user.uid).get();
  if (!userDoc.exists || userDoc.data().role !== "admin") {
    alert("No tienes permiso para acceder al panel de administración.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("adminInfo").innerHTML =
    `<b>Administrador:</b> ${adminUser.email}`;

  cargarReportesAdmin();
});

// Salir
document.getElementById("btnLogout").onclick = () => auth.signOut();


// --------------------------------------------------
//   LISTAR TODOS LOS REPORTES
// --------------------------------------------------

async function cargarReportesAdmin() {
  const reportesDiv = document.getElementById("adminReportes");
  reportesDiv.innerHTML = "Cargando reportes...";

  const snap = await db.collection("reportes")
    .orderBy("createdAt", "desc")
    .get();

  if (snap.empty) {
    reportesDiv.innerHTML = "No hay reportes.";
    return;
  }

  reportesDiv.innerHTML = snap.docs.map(doc => {
    const r = doc.data();
    const id = doc.id;

    return `
      <div class="reporte-box">
        <h3>${r.titulo} <small>(${r.ciudad})</small></h3>
        <p>${r.descripcion}</p>

        ${r.foto ? `<img src="${r.foto}" />` : ""}

        <p><b>Usuario:</b> ${r.usuario}</p>
        <p><b>Estado:</b> ${r.estado}</p>

        <button onclick="cambiarEstado('${id}', 'pendiente')">Pendiente</button>
        <button onclick="cambiarEstado('${id}', 'en proceso')">En Proceso</button>
        <button onclick="cambiarEstado('${id}', 'completado')">Completado</button>
      </div>
    `;
  }).join("");
}


// --------------------------------------------------
//   CAMBIAR ESTADO DE REPORTE
// --------------------------------------------------

async function cambiarEstado(id, nuevoEstado) {
  try {
    await db.collection("reportes").doc(id).update({
      estado: nuevoEstado
    });

    alert("Estado actualizado a: " + nuevoEstado);
    cargarReportesAdmin(); // vuelve a cargar la lista
  } catch (e) {
    alert("Error actualizando estado: " + e.message);
  }
}