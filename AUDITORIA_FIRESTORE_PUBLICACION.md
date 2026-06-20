# Auditoria Firestore para publicacion

Fecha: 2026-06-20

## Alcance y limites

- Auditoria estatica del codigo real cargado por `index.html`.
- No hay credenciales Admin, reglas Firestore ni acceso autorizado a los datos reales en este entorno. No se han medido cardinalidades reales, indices, trafico ni facturacion.
- Las cifras son documentos facturables aproximados. Los listeners vuelven a cobrar documentos recibidos al conectar y por cambios posteriores.
- Referencia de cuota gratuita usada: 50.000 lecturas, 20.000 escrituras y 20.000 borrados diarios. Blaze y las cuotas efectivas deben confirmarse en la consola del proyecto.

## A. Riesgos reales encontrados

1. **Resumen Sistema de Chat, alto desde 500 usuarios.** `iniciarListenerResumenSistema()` mantiene durante toda la sesion autenticada una consulta a los ultimos 100 mensajes de General. El filtrado de avisos Sistema ocurre despues, en cliente. Son hasta 100 lecturas iniciales por login, aunque el usuario no abra Chat, mas cambios posteriores.
2. **Jugadores y Clasificacion, alto si el uso es frecuente.** `cargarJugadores()` y `cargarClasificacionComunitaria()` hacen `usuarios.get()` sin filtro, limite ni paginacion. Jugadores cachea el resultado durante la sesion; Clasificacion repite la consulta en cada entrada.
3. **Clasificacion puede escribir.** En cada carga recalcula fiabilidad y penalizaciones de todos los usuarios. Normalmente escribe cero, pero puede emitir hasta una escritura por usuario cuyos valores guardados no coincidan.
4. **Historial y Estadisticas, alto con historico grande.** La primera carga admin descarga todo `historial_partidas` y todos los usuarios. Tras la correccion, los filtros reutilizan ambos resultados cinco minutos. Una primera carga con 50.000 historicos sigue costando unas 50.000 lecturas.
5. **Partidas, medio/alto.** Cada carga lee todas las partidas para cancelaciones, vuelve a consultar las confirmadas para postpartido y finalmente vuelve a leer todas para mostrar. Coste base aproximado: `2P + C`, donde `P` son partidas activas almacenadas y `C` las confirmadas. El render anade lecturas por pista, creador y hasta seis plazas por tarjeta, con repeticion de UIDs y pistas.
6. **Presencia, medio en escrituras.** Un usuario visible escribe al iniciar, cada cinco minutos y al ocultar/salir. Una hora visible ronda 14 escrituras. En movil y PC usa el mismo `visibilitychange`/`pagehide`; un cierre brusco puede no enviar offline, pero Chat descarta presencia con mas de seis minutos.
7. **Notificaciones, bajo/medio si crecen.** El listener carga todas las notificaciones propias sin limite y la limpieza de login consulta la misma coleccion propia otra vez. El coste inicial ronda `2N` por usuario con `N` pendientes almacenadas, mas los cambios del listener.
8. **Dependencia de limpieza cliente.** Notificaciones, mensajes y estados de partidas se limpian al entrar o actuar. Si no hay actividad, la limpieza se retrasa.

## B. Riesgos teoricos o condicionados

- `asegurarRevisionAvisosPostPartido()` conserva un intervalo de un minuto, pero no tiene llamadas actuales. Seria costoso si alguien lo reactivara.
- `resolverNotificacionesTemporalesPorPartidaId()` consulta por partida y filtra UID en cliente; puede fallar con reglas que solo autoricen consultas propias. Las reglas no estan en el repositorio.
- Una desconexion/reconexion de listeners puede volver a facturar el conjunto devuelto.
- Las consultas de borrado/anonimizacion de Perfil son numerosas, pero solo se ejecutan al eliminar una cuenta; no son coste continuo.
- No puede confirmarse si faltan indices ni si las reglas permiten lecturas mas amplias de lo necesario.

## C. Elementos seguros

- Jugadores, Clasificacion, Partidas y Estadisticas usan `get()`, no listeners permanentes.
- Jugadores filtra y ordena su cache local; no relee al buscar o cambiar sexo.
- No existe clasificacion mensual ni anual en el codigo actual. La unica pantalla es Clasificacion de Reputacion. Dia/semana/mes/ano/total son periodos de Estadisticas admin.
- El perfil normal no lee `historial_partidas`; el historico aparece en resincronizacion de partidas creadas y en la eliminacion/anonimizacion excepcional de cuenta, con consultas por UID.
- `cargarPartidas()` no lee `historial_partidas` ni documentos ya borrados, pero si descarga cualquier estado que siga dentro de `partidas`; los filtros de estado/fecha se aplican despues en cliente.
- Chat visible mantiene un solo listener de mensajes: General/Sistema limita 100 y privado/partida limita 30. Al cambiar de tab sustituye el listener; al salir de Chat lo cierra.
- General y privado tienen maximo logico de 100 y retencion de 30 dias. La limpieza se limita a una ejecucion cada cinco minutos por conversacion.
- Los listeners resumen de General, Sistema, partidas propias y privados propios se reemplazan antes de crearse y se cierran al logout.
- Usuarios online se escucha solo dentro de Chat y se cierra al salir.
- Notificaciones propias tienen un solo listener, se cierra al logout y las leidas se borran.
- `historial_partidas` guarda resumen de la partida, no mensajes ni imagenes.

## D. Coste estimado

Supuesto diario ilustrativo: `U` usuarios registrados hacen login una vez, abren una vez Jugadores y Clasificacion y mantienen la app visible una hora. No es una prediccion de trafico real.

| Operacion | 100 usuarios | 500 usuarios | 1.000 usuarios |
|---|---:|---:|---:|
| Una apertura individual de Jugadores | 100 lecturas | 500 | 1.000 |
| Todos abren Jugadores una vez | 10.000 | 250.000 | 1.000.000 |
| Todos abren Clasificacion una vez | 10.000 | 250.000 | 1.000.000 |
| Resumen Sistema al login, peor caso 100 docs | 10.000 | 50.000 | 100.000 |
| Presencia, una hora visible | ~1.400 escrituras | ~7.000 | ~14.000 |

Historial se mide por documentos historicos, no por usuarios: la primera carga cuesta aproximadamente `H + U`. Con 1.000, 10.000 y 50.000 partidas son unas 1.100, 10.500 y 51.000 lecturas si hay 100, 500 y 1.000 usuarios respectivamente. Antes de la correccion, cinco cambios de filtro multiplicaban ese coste por cinco; ahora reutilizan la carga dentro de cinco minutos.

Partidas cuesta como minimo `2P + C + pistas`, mas el N+1 visible. Notificaciones cuesta aproximadamente `2N` por login, donde `N` es la cantidad propia almacenada. Estos dos bloques no pueden convertirse honestamente a una cifra por usuarios sin conocer partidas activas y avisos medios.

Dictamen: 100 usuarios/DAU es publicable con vigilancia. A 500 el riesgo de superar cuota gratuita de lecturas es alto. A 1.000 la arquitectura actual no permite esperar coste cero con tranquilidad.

## E. Correcciones minimas recomendadas

1. Antes de acercarse a 500 DAU, sustituir el listener Sistema de 100 mensajes por metadatos agregados acotados; si el pendiente es individual, guardar un resumen por usuario.
2. Paginar Jugadores y Clasificacion en servidor, con campos normalizados e indices. Para una clasificacion completa estable, materializar posiciones o una coleccion de ranking.
3. Normalizar un timestamp de finalizacion en todo el historico, migrar documentos legacy y consultar dia/semana/mes/ano con rangos Firestore. Mantener Total como operacion admin paginada.
4. Consultar Partidas por estados/fechas visibles y cachear o agrupar referencias de usuarios/pistas. Separar el mantenimiento global de la carga de pantalla.
5. Crear alertas de presupuesto y revisar en Firebase Usage lecturas, escrituras, listeners y cardinalidades reales antes y despues de publicar.

## F. Correcciones aplicadas

- `estadisticas.js`: cache en memoria de cinco minutos para `historial_partidas` y el resumen de usuarios.
- Las solicitudes simultaneas comparten una unica promesa; un fallo limpia la promesa para permitir reintento.
- Los filtros, calculos, datos devueltos, interfaz y escrituras permanecen iguales.
- Versiones: `estadisticas.js?v=6`, `pwa.js?v=57`, cache/PWA `v98`.

## G. Correcciones no aplicadas

- No se paginaron Jugadores ni Clasificacion: cambiaria busqueda, orden completo y posiciones visibles.
- No se filtro historico por fecha en servidor: los documentos legacy pueden depender de `fecha` textual y se requiere migracion/indices antes de preservar resultados.
- No se cambio el resumen Sistema: requiere decidir y poblar un nuevo esquema de metadatos para conservar avisos pendientes por usuario.
- No se redujeron las consultas de Partidas: estan acopladas a cancelaciones y postpartido; compartir snapshots podria renderizar estado anterior al mantenimiento.
- No se cambio la frecuencia de presencia: alteraria la precision de online/offline.
- No se reordeno la limpieza de notificaciones: podria retrasar campana y popups al login.
- No se tocaron reglas, Cloud Functions, datos reales, ranking, partidas, chat, notificaciones ni perfiles.
