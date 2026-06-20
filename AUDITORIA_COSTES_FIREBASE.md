# Auditoria final de costes Firebase

Fecha: 2026-06-20

## Alcance y evidencia

- Firestore real no se pudo leer: REST devolvio `403 PERMISSION_DENIED`.
- Storage real no se pudo listar: API del bucket devolvio `401`.
- No hay `firebase.json`, reglas Firestore/Storage ni credenciales Admin en el repositorio.
- Las conclusiones sobre datos reales y reglas son, por tanto, no verificables desde este entorno.
- Todos los archivos JavaScript pasan `node --check` despues de las correcciones.
- Cuota gratuita Firestore documentada: 50.000 lecturas, 20.000 escrituras, 20.000 borrados diarios y 1 GiB almacenado.
- Desde el 3 de febrero de 2026 Cloud Storage for Firebase exige Blaze. Sigue habiendo uso sin coste, pero requiere facturacion vinculada.

Fuentes oficiales: [precios Firestore](https://firebase.google.com/docs/firestore/pricing), [listeners Firestore](https://firebase.google.com/docs/firestore/query-data/listen), [cambios de Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

## A. Riesgos reales encontrados

1. **Critico, corregido:** presencia escribia `usuarios/{uid}` cada 30 segundos, tambien en segundo plano. Un usuario visible 24 horas podia generar 2.880 escrituras/dia.
2. **Alto, corregido:** al abrir Partidas se iniciaba un intervalo de un minuto que leia toda `partidas` y despues las confirmadas durante toda la sesion.
3. **Alto, corregido:** cada mensaje podia provocar una lectura completa del chat para retencion, hasta unos 100 documentos por envio.
4. **Medio, corregido:** el listener de usuarios online se iniciaba al login aunque Chat no estuviera visible.
5. **Medio, corregido:** Perfil y Pistas dejaban listeners activos al cambiar de pantalla; editar Perfil creaba uno sin guardar `unsubscribe`.
6. **Medio, corregido:** `eliminarChatTotal()` usaba un unico batch y podia superar el limite de 500 operaciones.
7. **Alto a escala:** Jugadores y Clasificacion leen todos los usuarios por apertura, sin paginacion.
8. **Alto a escala:** Estadisticas lee todo `historial_partidas` y todos los usuarios cada vez que se carga o cambia el filtro.
9. **Medio/alto a escala:** `cargarPartidas()` hace lecturas globales y despues lecturas por pista, creador y jugadores (patron N+1).
10. **Condicion de publicacion:** Storage ya no puede funcionar en Spark desde 2026-02-03. Blaze conserva cuota sin coste, pero no garantiza coste cero duro.

## B. Riesgos teoricos o dependientes de reglas

- `resolverNotificacionesTemporalesPorPartidaId()` consulta por `partidaId` y filtra UID en cliente. Con reglas que solo permitan documentos propios, Firestore puede rechazar la consulta completa.
- `resolverNotificacionPorDedupe()` no borra avisos ajenos: retorna `false` si el UID no es el usuario actual. Las llamadas cross-user dejan avisos hasta que cada destinatario los resuelve o caducan.
- La limpieza normal de notificaciones procesa como maximo 400 documentos por login; un exceso requiere nuevas sesiones o la herramienta admin.
- Chats inactivos no se limpian hasta abrir/enviar. Es aceptable con volumen bajo, pero no es una tarea servidor.
- Los mensajes de partida se limitan de forma eventual: se limpian al abrir o enviar, con ventana anti-relecturas de cinco minutos.
- La funcion dormida `asegurarRevisionAvisosPostPartido()` aun contiene un intervalo de un minuto, pero no tiene llamadas en la aplicacion.

## C. Puntos ya seguros

- Notificaciones usan IDs deterministas cuando existe `dedupeKey`, evitando duplicados directos.
- Leidas se borran al abrir; marcar todas borra; caducadas/resueltas se limpian al iniciar notificaciones.
- Herramienta admin de notificaciones usa `get()` solo al pulsar y batches de 450.
- General y privado tienen retencion de 30 dias y maximo logico de 100.
- El listener visible de mensajes se sustituye al cambiar de tab y se cierra al salir de Chat.
- Listener de notificaciones se sustituye al autenticar y se cierra al logout.
- Listeners resumen de chat tienen un unico `unsubscribe` por clase y se cierran al logout.
- Partidas, Jugadores, Clasificacion y Estadisticas no usan listeners permanentes.
- Historial guarda resumen; no guarda mensajes, blobs ni multimedia.
- Reemplazar foto/perfil y foto/pista intenta borrar el archivo anterior y revierte el archivo nuevo si falla Firestore.
- Cache PWA elimina nombres antiguos durante `activate`; navegacion y scripts son network-first.

## D. Inventario de lecturas Firestore

| Archivo / funcion | Lectura | Filtro / limite | Ejecucion | Riesgo y recomendacion |
|---|---|---|---|---|
| `app.js` / dos `onAuthStateChanged` | `usuarios/{uid}.get()` | Documento | Login, dos veces | Bajo por usuario; unificar en futuro |
| `app.js` / `guardarPerfilRegistro` | `usuarios` | `nombreNormalizado ==`, sin limit | Registro | Bajo; igualdad selectiva |
| `app.js` / `cargarClasificacionComunitaria` | `usuarios.get()` | Sin filtro/limit | Abrir Clasificacion | Alto desde 500; paginar o materializar ranking |
| `jugadores.js` / `cargarJugadores` | `usuarios.get()` | Sin filtro/limit | Abrir Jugadores | Alto desde 500; paginar 25-50 |
| `perfil.js` / perfil social | `usuarios/{uid}` | Documento | Abrir Perfil | Bajo |
| `perfil.js` / seguidores | varios `usuarios/{uid}` | Un doc por UID | Abrir lista social | Medio si listas grandes; paginar |
| `perfil.js` / listeners Perfil | `usuarios/{uid}` | Documento | Solo pantalla Perfil | Bajo tras correccion; se cierran al salir |
| `perfil.js` / eliminar cuenta | usuarios, partidas, historial, notificaciones, chats | Filtradas; una global de usuarios | Accion excepcional | Medio/alto puntual, aceptable |
| `pistas.js` / `cargarPistas` | `pistas.onSnapshot()` | Sin filtro/limit | Solo pantalla Pistas | Bajo/medio; cerrar al salir ya aplicado |
| `pistas.js` / validacion duplicado | `pistas.get()` | Sin filtro/limit | Crear pista | Bajo con pocas pistas; futuro indices por campos normalizados |
| `partidas.js` / `cargarPartidas` | `partidas.get()` | Sin filtro/limit | Abrir/refrescar Partidas | Medio; futuro consultas por estado/fecha |
| `partidas.js` / mantenimiento previo | `partidas.get()` y confirmadas | Global + estado | Cada carga de Partidas | Medio; ya no corre cada minuto ni login |
| `partidas.js` / filtro pistas | `pistas.get()` | Sin filtro/limit | Cada carga Partidas | Bajo si pocas pistas; cache de sesion futura |
| `partidas.js` / render | pista, creador, jugadores | Documentos individuales | Por tarjeta visible | Medio/alto N+1; cache de sesion futura |
| `partidas.js`, `postpartido.js`, `nivel.js` | transacciones | Partida + 0-4 usuarios/pista | Accion de negocio | Bajo; lecturas necesarias y acotadas |
| `chat.js` / chat visible | mensajes `onSnapshot` | General/Sistema 100; privado/partida 30 | Solo Chat visible | Medio y acotado |
| `chat.js` / resumen General | `chats/general.onSnapshot()` | Documento | Sesion autenticada | Bajo, necesario para no leidos |
| `chat.js` / resumen Sistema | mensajes `onSnapshot` | Orden fecha, limit 100 | Sesion autenticada | Medio: hasta 100 lecturas iniciales por login |
| `chat.js` / resumen partidas | dos `onSnapshot` | jugador/reserva contiene UID | Sesion autenticada | Bajo/medio; solo partidas propias |
| `chat.js` / resumen privados | `onSnapshot` | `participantesMap.uid == true` | Sesion autenticada | Bajo/medio; solo chats propios |
| `chat.js` / usuarios online | `onSnapshot` | `online == true` | Solo pantalla Chat | Medio segun concurrentes; ya no global |
| `chat.js` / retencion | mensajes `get()` | Orden fecha, sin limit | Maximo una vez/5 min/chat activo | Medio; antes era por mensaje |
| `notifications.js` / listener | `notificaciones.onSnapshot` | `uid == actual`, sin limit | Sesion autenticada | Bajo si limpieza funciona; vigilar pendientes |
| `notifications.js` / limpieza propia | `notificaciones.get()` | `uid == actual` | Login | Bajo/medio, max 400 borrados |
| `notifications.js` / admin | `notificaciones.get()` | Global | Solo boton admin | Medio puntual; mantener en Mantenimiento |
| `admin-chat-cleanup.js` / auditoria | todos mensajes General + partidas referidas | Sin limit en mensajes | Solo boton admin | Medio puntual; mantener |
| `estadisticas.js` / `cargarEstadisticas` | historial + usuarios + pistas | Historial global | Abrir/cambiar filtro admin | Alto a largo plazo; filtrar en servidor/paginar |
| `estadisticas.js` / resincronizar | `partidas.get()` | Global | Solo boton admin confirmado | Medio puntual; mantener |
| `postpartido.js` / revision | partidas | `estado == confirmada` | Carga Partidas | Bajo/medio; sin intervalo activo |

Los `batch` escriben/borran, no leen. Las transacciones releen en caso de conflicto; estan ligadas a acciones concretas, no a listeners.

## E. Inventario de listeners

| Listener | Alta | Baja | Duplicacion | Riesgo |
|---|---|---|---|---|
| Mensajes chat visible | Entrar/cambiar tab | Cambiar tab/salir Chat/logout | No, `listenerActivo` | Bajo/medio |
| Usuarios online | Entrar Chat | Salir Chat/logout | No | Bajo/medio tras correccion |
| Resumen General | Login | Logout/relogin | No | Bajo |
| Resumen Sistema limit 100 | Login | Logout/relogin | No | Medio |
| Dos resumenes Partidas propias | Login | Logout/relogin | No | Bajo/medio |
| Resumen privados propios | Login | Logout/relogin | No | Bajo/medio |
| Notificaciones propias | Login | Logout/relogin | No | Bajo/medio |
| Perfil visto | Abrir Perfil | Cambiar perfil/salir | No tras correccion | Bajo |
| Estado seguir del usuario actual | Abrir perfil ajeno | Salir/cambiar perfil | No tras correccion | Bajo |
| Pistas global | Abrir Pistas | Salir/reabrir | No tras correccion | Bajo/medio |

Clasificacion, Jugadores, Partidas y Estadisticas no mantienen `onSnapshot`.

## F. Limpiezas y crecimiento

| Recurso | Limpieza | Dependencia | Riesgo sin actividad |
|---|---|---|---|
| Notificaciones | leida/resuelta/caducada, propias | Login/accion; admin manual global | Persisten hasta siguiente login o admin |
| General | 100 y 30 dias | Abrir/enviar, max una vez/5 min | Chat inactivo conserva documentos |
| Privado | 100 y 30 dias | Abrir/enviar, max una vez/5 min | Conversacion inactiva conserva documentos |
| Partida | 100 eventual; borrado total | Abrir/enviar; cancelar/finalizar/historial | Flujos manuales Firebase pueden dejar subcoleccion |
| Sistema | resolucion por evento + auditor admin | Acciones de partida/admin | Avisos fallidos pueden quedar hasta auditoria |
| Partidas muertas | estados/fechas revisados | Abrir Partidas | Si nadie entra, limpieza se retrasa |
| Historial | Se conserva | Finalizacion | Crecimiento lineal ligero e intencionado |
| Storage | Borra anterior/revertido/recurso eliminado | Acciones normales cliente | Borrado manual Firebase deja huerfanos |

La dependencia del cliente es aceptable para una comunidad pequena y evita Cloud Functions. Debe existir una rutina admin manual mensual.

## G. Storage

- Subida perfil: `usuarios/{uid}/foto_{timestamp}.jpg`.
- Sustitucion perfil: actualiza Firestore; si falla, borra nueva; si funciona, borra anterior.
- Baja perfil: borra URL referenciada y enumera `usuarios/{uid}`.
- Subida pista: `pistas/{timestamp}.jpg`.
- Sustitucion/eliminacion pista: borra `pistas/` o legacy `imagenesPistas/` si la URL es reconocida.
- Legacy admitido: `fotosPerfil/`, `imagenesPistas/`.
- Si Storage falla al borrar, la operacion principal continua y registra warning: puede quedar huerfano.
- Si se borra manualmente Firestore/Auth, no se ejecuta ninguna limpieza Storage.
- Comparacion manual: inventariar `usuarios.fotoPerfil`, `pistas.imagen` y legacy `pistas.imagenUrl`; conservar toda ruta referenciada y borrar solo la diferencia confirmada.
- No borrar `imagen/hombre.jpeg`, `imagen/mujer.jpeg`, iconos, logo ni imagenes referenciadas.
- El tamano real no pudo calcularse por `401`; revisar Usage del bucket y exportar listado con nombre/tamano.

## H. Herramientas admin

| Herramienta | Lecturas/escrituras | Activacion | Recomendacion |
|---|---|---|---|
| Estadisticas | historial global + usuarios + pistas | Abrir/filtro | Mantener oculta; no usar repetidamente con historial grande |
| Auditar Sistema | mensajes General global + partidas referidas | Boton | Mantener; no listener |
| Eliminar Sistema obsoleto | batches hasta 450 | Boton tras auditoria/confirmacion | Mantener |
| Resincronizar Sistema | todas partidas + escrituras solo activas | Boton/confirmacion | Mantener para mantenimiento excepcional |
| Limpiar notificaciones | todas notificaciones + batches 450 | Boton | Mantener para mantenimiento mensual |

El panel ya esta bajo administracion. No conviene eliminar estas herramientas; su coste es puntual y controlable.

## I. Notificaciones cross-user

- Las creaciones para varios UIDs escriben un documento por destinatario.
- Las agrupadas de seguidores usan transaccion y documento determinista; no duplican mientras el aviso este pendiente.
- `resolverNotificacionPorDedupe(uid, key)` solo opera si `auth.currentUser.uid === uid`. Las llamadas para reservas/creador/participantes ajenos retornan `false` sin intentar borrar.
- No se puede borrar de forma segura para otros usuarios desde cliente sin reglas demasiado permisivas o backend confiable.
- La basura residual no duplica por dedupe, pero puede dejar un aviso ya no procedente hasta login/caducidad.
- Solucion gratuita aceptada: caducidad + limpieza propia + herramienta admin. No ampliar reglas cross-user.
- La campana filtra `leida !== true && resuelta !== true`; al abrir, el documento se borra.

## J. Historial y estadisticas

`historial_partidas` guarda ID, tipo, estado, fecha/hora, pista, genero/nivel, jugadores/reservas, participantes, resultado, valoraciones, creador y timestamps. No incluye chats ni imagenes.

Estimacion cualitativa: normalmente pocos KB por partida. Incluso 10.000 partidas deberian ocupar decenas de MB, lejos de 1 GiB, salvo valoraciones anormalmente grandes. El coste primero sera lecturas, no almacenamiento.

Los filtros dia/semana/mes/ano/total filtran correctamente en cliente, pero todos descargan el historial completo. Recomendacion futura: guardar un timestamp consultable y aplicar `where` para periodos; reservar Total para uso manual paginado.

## K. PWA y cache

- Cache actual: `padel-players-morvedre-v97`; al activar elimina todos los nombres anteriores.
- Navegacion usa red y no conserva `index.html` viejo; offline responde 503.
- JS/CSS usan network-first con `cache: reload`; las versiones de archivos modificados estan incrementadas.
- Recursos externos no se guardan en Cache Storage por el service worker.
- Imagenes locales usan cache-first, pero el conjunto es finito. Las imagenes Firebase dependen del cache HTTP del navegador.
- Comprobacion de service worker: al inicio, foco, online, visibilidad y cada hora. Coste de red bajo; no consume Firestore.
- Riesgo PWA/cache: bajo. La PWA no ofrece arranque offline completo, pero esto no crea coste Firebase relevante.

## L. Escenarios de escala

Supuesto ilustrativo: una hora visible por usuario/dia, presencia cada cinco minutos, actividad comunitaria moderada. No son mediciones reales.

| DAU | Presencia aproximada | Riesgo lecturas | Riesgo escrituras | Dictamen |
|---:|---:|---|---|---|
| 50 | ~700 escrituras/dia | Bajo; Sistema hasta 5.000 lecturas/login agregadas | Bajo | Apto con vigilancia basica |
| 100 | ~1.400 | Medio; Sistema hasta 10.000 mas pantallas globales | Bajo/medio | Apto con alertas y Usage semanal |
| 500 | ~7.000 | Alto; Sistema puede llegar por si solo a 50.000 | Medio | Paginar usuarios e historial antes |
| 1000 | ~14.000 | Muy alto; Sistema hasta 100.000, mas consultas globales | Alto: queda poco margen de 20.000 | No apto sin optimizacion |

Ejemplo de actividad orientativo:

| DAU | Partidas/dia | Mensajes/dia | Notificaciones/dia | Riesgo dominante |
|---:|---:|---:|---:|---|
| 50 | 3-5 | 100 | 100-200 | Ninguno inmediato |
| 100 | 5-10 | 250 | 250-500 | Resumen Sistema y listas globales |
| 500 | 25-50 | 1.500 | 1.500-3.000 | 50k lecturas, N+1 de Partidas |
| 1000 | 50-100 | 3.000 | 3.000-6.000 | Lecturas y presencia cerca/sobre cuota |

Lo que escala peor es `usuarios.get()` por cada apertura, historial global admin y el listener Sistema de hasta 100 documentos por login. Vigilar primero `Firestore document reads`, despues `writes` de presencia, `active listeners`, Storage descargado y objetos totales.

## M. Correcciones aplicadas

1. Presencia cada cinco minutos, detenida y marcada offline al ocultar/salir.
2. Eliminada revision global de partidas al login y eliminado el intervalo de un minuto iniciado por Partidas.
3. Usuarios online se escuchan solo dentro de Chat.
4. Chat visible ya no se abre automaticamente al cargar/login.
5. Retencion de chat limitada a una ejecucion cada cinco minutos por conversacion.
6. Chat de partida tambien se limpia al abrir.
7. `eliminarChatTotal()` repite lecturas/batches de 450 hasta vaciar.
8. Listeners Perfil/Pistas se cierran al abandonar la pantalla; editar Perfil usa `get()`.
9. Versiones PWA/cache actualizadas a `v97`.
10. Fotos de perfil y pistas se convierten a JPEG, se redimensionan y tienen limites estrictos de 450/900 KB.
11. Fotos en Jugadores, Clasificacion y Pistas usan carga diferida.

No se cambiaron reglas de negocio, reglas Firebase, esquemas, notificaciones, ranking, estadisticas ni permisos. No se anadieron Cloud Functions ni listeners.

## N. Correcciones no aplicadas

- No se tocaron Firestore Rules porque no estan disponibles.
- No se implemento borrado cross-user inseguro.
- No se paginaron Jugadores/Clasificacion/Historial por ser un cambio funcional mayor.
- No se materializaron contadores ni estadisticas agregadas nuevas.
- No se elimino Storage ni se borraron archivos reales.
- No se anadieron tareas servidor.

## O. Conclusion de publicacion

**No publicable como proyecto estrictamente Spark/gratuito**, porque Cloud Storage exige Blaze desde 2026-02-03.

**Publicable con vigilancia para una comunidad inicial de hasta unos 100 DAU** si se acepta Blaze con cuota sin coste, se vincula facturacion conscientemente, se crean alertas presupuestarias y se revisa Usage semanal. Las alertas no son un limite duro de gasto.

Antes de crecer hacia 500 DAU: paginar Jugadores/Clasificacion, consultar historial por periodo y sustituir el resumen Sistema de 100 documentos por metadatos acotados. A 1000 DAU la arquitectura actual no debe considerarse gratuita de forma fiable.
