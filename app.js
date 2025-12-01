// app.js - Lógica principal de RECOLECTA-RD
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// UI elements
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const listaReportesEl = document.getElementById('listaReportes');
const misSolicitudesContent = document.getElementById('misSolicitudesContent');
const userPanel = document.getElementById('userPanel');

// Botones del index
document.getElementById('btnOpenLogin').addEventListener('click', mostrarLoginModal);
document.getElementById('btnReport').addEventListener('click', () => {
  if (!currentUser) {
    mostrarLoginModal();
    return;
  }
  mostrarReporteModal();
});

let currentUser = null;
let currentUserRole = 'guest';

// Detecta cuando el usuario inicia/cierra sesión
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;

    // Buscar el rol del usuario
    const userDoc = await db.collection('users').doc(user.uid).get();

    if (userDoc.exists) {
      currentUserRole = userDoc.data().role || 'user';
    } else {
      // Sistema "bootstrap": el primer usuario registrado es admin
      const adminsSnap = await db.collection('admins').get();
      if (adminsSnap.empty) {
        await db.collection('admins').add({ uid: user.uid, email: user.email });
        await db.collection('users').doc(user.uid).set({
          email: user.email,
          name: user.displayName || '',
          role: 'admin'
        });
        currentUserRole = 'admin';
      } else {
        const isAdmin = (await db.collection('admins')
          .where('email', '==', user.email)
          .get()).docs.length > 0;

        currentUserRole = isAdmin ? 'admin' : 'user';

        await db.collection('users').doc(user.uid).set(
          {
            email: user.email,
            name: user.displayName || '',
            role: currentUserRole
          },
          { merge: true }
        );
      }
    }

    renderUserPanel();
    cargarReportes();
    cargarMisSolicitudes();

  } else {
    currentUser = null;
    currentUserRole = 'guest';
    renderUserPanel();
    listaReportesEl.innerHTML = "";
    misSolicitudesContent.innerHTML = "Inicia sesión para ver tus solicitudes.";
  }
});

// Panel superior del usuario
function renderUserPanel() {
  if (!currentUser) {
    userPanel.innerHTML = `<button id="loginBtnSmall">Ingresar</button>`;
    document.getElementById('loginBtnSmall').onclick = mostrarLoginModal;
    return;
  }

  userPanel.innerHTML = `
    👤 ${currentUser.email}
    <button id="logoutBtn">Cerrar sesión</button>
    ${currentUserRole === 'admin' ? '<a href="admin.html" style="color:#fff; margin-left: 10px;">Panel Admin</a>' : ''}
  `;

  document.getElementById('logoutBtn').onclick = () => auth.signOut();
}

// -------------------- LOGIN --------------------------
function mostrarLoginModal() {
  modalContent.innerHTML = `
    <h3>Ingresar</h3>
    <input id="loginEmail" placeholder="Correo" />
    <input id="loginPassword" type="password" placeholder="Contraseña" />
    <br><br>
    <button id="doLogin">Ingresar</button>
    <button id="showRegister">Registrarse</button>
    <p><a href="#" id="forgotPwd">Olvidé mi contraseña</a></p>
  `;
  modal.style.display = "flex";

  document.getElementById("doLogin").onclick = hacerLogin;
  document.getElementById("showRegister").onclick = mostrarRegisterModal;
  document.getElementById("forgotPwd").onclick = enviarResetPassword;
}

async function hacerLogin() {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPassword').value;

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    modal.style.display = "none";
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// -------------------- REGISTRO --------------------------
function mostrarRegisterModal() {
  modalContent.innerHTML = `
    <h3>Crear cuenta</h3>
    <input id="regName" placeholder="Nombre y Apellido" />
    <input id="regEmail" placeholder="Correo" />
    <input id="regPassword" type="password" placeholder="Contraseña" />
    <br><br>
    <button id="doRegister">Registrar</button>
  `;
  modal.style.display = "flex";

  document.getElementById("doRegister").onclick = hacerRegistro;
}

async function hacerRegistro() {
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const pass = document.getElementById('regPassword').value;

  if (!name || !email || !pass) {
    alert("Completa todos los campos.");
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });

    // Asignar rol por defecto
    await db.collection('users').doc(cred.user.uid).set({
      name,
      email,
      role: "user"
    });

    modal.style.display = "none";

  } catch (e) {
    alert("Error: " + e.message);
  }
}

// -------------------- RESET PASSWORD --------------------------
async function enviarResetPassword() {
  const email = document.getElementById('loginEmail').value;
  if (!email) return alert("Introduce tu correo para recuperar tu contraseña.");

  try {
    await auth.sendPasswordResetEmail(email);
    alert("Correo enviado para restablecer contraseña.");
  } catch (e) {
    alert(e.message);
  }
}

// -------------------- CREAR REPORTE --------------------------
function mostrarReporteModal() {
  modalContent.innerHTML = `
    <h3>Nuevo Reporte</h3>
    <input id="repTitulo" placeholder="Título del reporte" />
    <select id="repCiudad">
      <option>Santo Domingo</option>
      <option>Santiago</option>
      <option>San Cristóbal</option>
      <option>La Vega</option>
    </select>
    <textarea id="repDescripcion" placeholder="Descripción"></textarea>
    <input type="file" id="repFoto" />
    <br><br>
    <button id="doSendReport">Enviar</button>
  `;
  modal.style.display = "flex";

  document.getElementById("doSendReport").onclick = enviarReporte;
}

async function enviarReporte() {
  const titulo = document.getElementById('repTitulo').value;
  const ciudad = document.getElementById('repCiudad').value;
  const descripcion = document.getElementById('repDescripcion').value;
  const foto = document.getElementById('repFoto').files[0];

  if (!titulo || !ciudad || !descripcion) {
    alert("Completa todos los campos.");
    return;
  }

  let fotoUrl = null;

  try {
    if (foto) {
      const ref = storage.ref().child("reportes/" + Date.now() + "_" + foto.name);
      await ref.put(foto);
      fotoUrl = await ref.getDownloadURL();
    }

    await db.collection('reportes').add({
      titulo,
      ciudad,
      descripcion,
      foto: fotoUrl,
      usuario: currentUser.email,
      estado: "pendiente",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    modal.style.display = "none";
    cargarReportes();

  } catch (e) {
    alert(e.message);
  }
}

// -------------------- LISTAR REPORTES --------------------------
async function cargarReportes() {
  listaReportesEl.innerHTML = "Cargando...";

  const snap = await db.collection('reportes')
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  if (snap.empty) {
    listaReportesEl.innerHTML = "No hay reportes.";
    return;
  }

  listaReportesEl.innerHTML = snap.docs.map(doc => {
    const r = doc.data();
    return `
      <div style="background:white;padding:12px;margin-bottom:12px;border-radius:8px;">
        <h3>${r.titulo} <small>(${r.ciudad})</small></h3>
        <p>${r.descripcion}</p>
        ${r.foto ? `<img class="report-foto" src="${r.foto}" />` : ""}
        <small>Usuario: ${r.usuario}<br>Estado: ${r.estado}</small>
      </div>
    `;
  }).join("");
}

// -------------------- MIS SOLICITUDES --------------------------
async function cargarMisSolicitudes() {
  if (!currentUser) {
    misSolicitudesContent.innerHTML = "Inicia sesión para ver tus solicitudes.";
    return;
  }

  const snap = await db.collection('solicitudes')
    .where("usuario", "==", currentUser.email)
    .orderBy("fechaSolicitud", "desc")
    .get();

  if (snap.empty) {
    misSolicitudesContent.innerHTML = "No tienes solicitudes.";
    return;
  }

  misSolicitudesContent.innerHTML = snap.docs.map(d => {
    const s = d.data();
    return `
      <div style="background:white;padding:12px;margin-bottom:12px;border-radius:8px;">
        <h4>${s.tipo}</h4>
        <p>${s.direccion}</p>
        <small>${s.estado}</small>
      </div>
    `;
  }).join("");
}

// Cerrar modal al hacer clic afuera
modal.addEventListener("click", e => {
  if (e.target === modal) modal.style.display = "none";
});