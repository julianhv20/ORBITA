"""
Constructor del Léxico General Español (lexicon_es.txt) para ÓRBITA.
Permite diferenciar en < 0.1 ms en el navegador:
  - Errores de tipeo / cadenas sin sentido ('asdfg', 'qwertz') -> 0 Impulsos consumidos
  - Palabras reales del español sin vínculo con el núcleo ('hipopótamo', 'tostadora') -> Vacío Exterior (-1 Impulso)
"""

from __future__ import annotations
from pathlib import Path
from .text_norm import normalize_word, generate_inflections

# Base léxica amplia de vocabulario español cotidiano, académico, natural y técnico
# (se expande automáticamente con flexiones regulares nominales, adjetivales y verbales)
_SPANISH_ROOT_VOCAB = """
abaco abadia abajo abanico abeja abeto abierto abismo abogado abono abrazo abrigo abril abrir absoluto
abuela abuelo abundancia aburrido academia accion aceite aceituna acento acera acero acertijo acido
aclarar acolchado acomodar acompañar acorde acordeon acostar actitud activar actividad acto actor actriz
acuarela acuario acuerdo acumular acusar adelante adelantar ademas adentro aderezo adicto adios adivinar
adjetivo administracion admirar admitir adobe adolescente adoptar adorno adquirir aduana adulto advertir
aereo aerodromo aerolinea aeropuerto afecto afeitar aficion afilado afirmar afliccion aflojar afuera
agachar agarrar agencia agenda agente agil agitar agonia agosto agotar agradable agradecer agricola
agricultura agrio agua aguacate aguacero aguardar agudo aguila aguja agujero ahi ahogar ahora ahorrar
aire aislar ajedrez aji ajo ajustar ala alambre alameda alamo alargar alarma alba albahaca albañil
alberca albergue alboroto album alcachofa alcalde alcancia alcantarilla alcance alcanzar alcoba alcohol
aldea alegrar alegria alegre alejar aleman alergia aleta alfabético alfabeto alfombra alforja alga
algebra algo algodon algoritmo alguacil alguien algun alhaja aliado alianza aliento alicates alimento
alivio alla alli alma almacen almeja almendra almidon almirante almohada almuerzo alojar alquilar
alquimia alrededor altar alterar altitud alto altura aludir alumbrar aluminio alumno alzar amable
amaca amanecer amante amapola amargo amarillo amarrar amasar amatista ambicion ambiente ambito ambulancia
amenaza america amigo amistad amonestacion amor amortiguador amparo ampliar amplio ampolla amuleto
analisis analizar analogia anana anatomia anciano ancla ancho anchoa anciano andar andamio anden anecdota
anemia angel angosto anguila angulo anillo animal animar animo aniversario ano anoche antena anteojos
antepasado anterior antes antibiótico anticipar anticuado antidoto antiguo antilope antorcha antropologia
anual anudar anunciar anuncio anzuelo añadir añejo año apagar aparato aparecer apariencia apartar
apartamento apasionado apego apellido apena apendice apetito apio aplaudir aplauso aplicar aplomo apodo
apolillar apoyar apoyo aprender aprendiz aprendizaje apresurar apretar aprobar apropiado aprovechar
aproximar apuesta apuntar apurar aquel arado araña arandano arancel arar arbitro arbol arbusto arca
arcangel archivo arcilla arco arcoiris arder ardilla area arena argolla argumento arido arista aritmetica
arlequin arma armadura armario armonia aroma arquero arquitecto arquitectura arrancar arrasar arrastrar
arreglar arreglo arriba arriendo arriesgar arrodillar arrojar arroyo arroz arruga arte artefacto arteria
artesania artesano articular articulo artificial artilleria artista asado asaltar asamblea asar ascensor
ascenso asco asegurar aserrin asesor asfalto asi asiento asilo asistir asma asociacion asomar asombro
aspecto aspero aspiradora aspirar asta asteroide astilla astro astrologia astronauta astronomia astucia
astuto asumir asunto asustar atacar atajo atar atardecer atasco ataud atencion atender ateo aterrizar
atleta atletismo atlas atmosfera atomo atrapar atras atravesar atreverse atril atun audaz audicion
audifono auditorio aula aumento aun aunque aurora ausente autobus automovil autonomia autopsia autor
autoridad auxilio avance avanzar avaricia ave avellana avena avenida aventura avergonzar averia avestruz
avion avisar aviso avispa axila ayer ayuda ayudar ayuno azafran azar azotea azucar azufre azul azulejo
baba babosa bacalao bache bacteria badajo bagaje bahia bailar baile bajar bajo bala balada balance
balanza balcon balde baldosa ballena ballet balon balsa balsamo bambu banana banco banda bandeja bandera
bandido banquete bañar bañera baño barato barba barbacoa barbero barbilla barco barda barniz barometro
baron barra barranco barrer barrera barriga barril barrio barro barroco basar bascula base basico
basilica bastante bastidor baston basura batalla batir baul bautizo baya bazar bazo bebe beber bebida
beca becerro beisbol belen belleza bello bellota bendecir beneficio berenjena berro besar beso bestia
betun biberon biblia biblioteca bicicleta bien bienestar bienvenida bigote bilis billar billete biografia
biologia biombo biosfera bipedo birrete bisabuelo bisagra bisnieto bistec bisturi bizcocho blanco blando
blanquear blason blindaje bloque bloquear blusa boa bobina boca bocadillo boceto bocina boda bodega
bofeton boga bogavante boina bola boletin boleto boligrafo bolsillo bolso bomba bombilla bombero bombon
bondad bonito bono borde bordado bordo borracho borrador borrar borrasca bosque bostezo bota bote
botella botica botin boton boveda boxeo boya bozal brazo brea brecha breve bribón bricolaje brida
abrigo brillante brillar brillo broma bronce brocha brocoli brotar brote bruja brujula bruma brusco
bruto buceo bucle buda buen bueno buey bufalo bufanda bufon buhardilla buho buitre bujia bulevar bulto
buque burbuja burdel burgues burla burro buscar busqueda butaca buzo buzon
caballete caballero caballo cabaña cabello cabeza cabina cable cabra cacahuete cacao cacerola cacto
cactus cada cadaver cadena cadera caducar caer cafe cafetera caja cajero cajon cal calabaza calamar
calambre calamidad calavera calcetin calcio calculo caldo calendario calentar calidad calido califa
calificar caliz callar calle callejon callo calma calor calvo calzado cama camaleon camara camarero
camaron cambiar cambio camello caminar camino camion camisa camiseta campamento campana campanario
campaña campeon campesino campo cana canal canasta cancion candado candela candidato canela cangrejo
canguro canica canibal canoa canon cansado cansancio cantar cantaro cantina canto caña cañon caoba caos
capa capacidad capaz capilla capital capitan capitulo capricho capsula capucha cara caracol caracter
caramelo carbon carcajada carcel cardenal cardo careta carga cargar cargo caricia caridad cariño carmesí
carnaval carne carnicero caro carpintero carpeta carrera carreta carretera carril carrito carro carroza
carta cartel cartera cartero cartilago carton casa casada cascabel cascada cascara casco casi casilla
casino caso caspa castaña castaño castigar castigo castillo castor casualidad catalogo catarata catastrofe
catedral categoria cateto catolico catorce cauce caucho caudal causa causar cautela cavar caverna caza
cazar cazuela cebada cebolla cebra ceder cedro cegar ceja celda celebrar celeste celibato celula cemento
cena cenar cenicero cenit censo censura centauro centavo centella centeno centigrado centimetro central
centro cepillo cera ceramica cerca cercano cerdo cereal cerebelo cerebro ceremonia cereza cerilla cero
cerradura cerrar cerro cerrojo certeza cerveza cesar cesped cesta cetro chakal chal chaleco chaman
champu chancla chaqueta charco charla charlar chasis chatarra chef cheque chicle chico chimenea chimpance
chinche chino chiste chivo chocar chocolate chofer choque chorizo chorro choza chubasco chuleta chupar
cicatriz ciclismo ciclo ciclon ciego cielo cien ciencia cientifico ciervo cifra cigarra cigarro cilindro
cima cimiento cinc cincel cinco cine cinta cintura cinturon cipres circo circuito circulo ciruela
cirugia cirujano cisne cita citar ciudad ciudadano civico civilizacion clamar clamor clan clandestino
clara clarinete claridad claro clase clasico clavar clavel clavicula clavo cliente clima clinica cloaca
cloro club coagulo cobarde cobertizo cobija cobre cobro cocodrilo coche cochino cocina cocinar coco
cocodrilo codo codorniz cofre coger cohete cojin cojo col cola colador colapso colchon coleccion colega
colegio colera colgar colibri coliflor colina collar colmena colmillo colocar colonia color columna
columpio coma comadreja comandante comarca comba combate combinar comedia comedor comentar comercio
cometa cometer comida comienzo comision comite como comoda comodo compacto compañia compañero comparar
compartir compas compasion competir complacer complejo completar completo complicar complice componente
componer comportar compra comprar comprender compresa compromiso comun comunicar comunidad con concebir
conceder concentrar concepto conciencia concierto concha concluir conclusion concordia concreto condena
condicion condor conducir conducta conectar conejo confeccion conferencia confesar confianza confiar
confirmar conflicto conformar confundir confusion congelar congreso conjunto conmemorar conmigo conmocion
conocer conocimiento conquista consagrar consecuencia conseguir consejo consentir conservar considerar
consigna consola consolar consonante constante constelacion constitucion construir consuelo consultar
consumir contabilidad contacto contagio contaminar contar contemplar contenedor contener contenido
contento contestar contexto continente continuar contorno contra contradiccion contraer contrario
contrato contraste control convencer convencion convenir convento conversar convertir convidar convivir
convocar conyuge cooperar coordenada copa copo coraje coral corazon corbata corcho cordero cordon
cordillera coreografia corneta cornisa coro corona coronel corpiño corporacion corral correa corregir
correo correr corredor corriente corroer corrupcion corte corteza cortina corto cosecha coser cosmetico
cosmos costa costar costilla costumbre costura cota cotidiano cotorra coyote craneo crater crear crecer
crecimiento credito creer crema crepusculo crecer cresta cria criar criatura crimen crin cristal criterio
critica cronica cruce crucero cuaderno cuadra cuadrado cuadro cuajada cual cualquier cuando cuanto
cuarenta cuaresma cuartel cuarto cuarzo cuatro cubeta cubrir cucaracha cuchara cuchillo cuello cuenca
cuenco cuenta cuento cuerda cuerno cuero cuerpo cuervo cuesta cuestion cueva cuidar culebra culpa
cultivar cultivo cultura cumbre cuna cuñado cura curar curiosidad curioso curso curva cutis
daga dama danza danzar dar dardo datil dato debacle debajo debate deber debil decada decano decente
decidir decimal decimo decir decision declamar declarar declive decorar decreto dedal dedicar dedo
deducir defecto defender defensa definir definitivo deformar degollar dejar delantal delante delegado
deleite delfin delgado deliberar delicado delito demas demasiado democracia demonio demora demostrar
denso dentadura dentro denunciar departamento depender deporte depositar deposito derecha derecho deriva
derramar derretir derribar derrota desafio desaparecer desayuno desarrollar desarrollo desastre desatar
descansar descanso descargar desconfiar desconocer describir descubrir descuento desde desear deseo
desesperar desfiladero desfile desgarrar desgracia deshacer deshidratar desierto designar desigual
deslizar desmayar desnudo desobedecer desorden despacio despacho despedir despegar despejar despertar
despido desierto desplazar desplegar despojar desprecio despues destacar destino destreza destruir
detalle detectar detective detener detras deuda dia diablo diadema diagnostico diagonal diagrama dialecto
dialogo diamanteiana diario dibujo diccionario dicha diente dieta diez diferente dificil difundir digerir
digno diluvio dimension dinamita dinero dinosaurio dios diploma direccion directo director dirigir
disciplina disco disculpa discurso diseño disfraz disfrutar disgusto disimular disminuir disolver
disparar disparo dispersar disponer distancia distinto distraer distribuir distrito divan diverso dividir
divino divorcio divulgar dobles doce docena doctor documento dogma dolar doler dolor domar domestico
domingo dominar dominio donar doncella donde dorado dormir dormitorio dorso dos dosis dragon drama
drenaje droga ducha duda dudar duende dueño dulce dulzura duna duo duplicar durazno dureza duro
ebano ebrio eclipse economia ecuacion edad edificio editar educacion efecto eficaz ego eje ejecutar
ejemplo ejercer ejercito el elastico eleccion electricidad electrico elefante elegante elegir elemento
elevar eliminar elogio embajada embarazar embarazo embarcacion embargo embudo eminencia emitir emocion
empacar empujar empatia emperador empezar empleado empleo empobrecer emprender empresa empujar empuje
enano enamorar encajar encaje encargar encender encia encima encina encoger encontrar encuentro encuesta
enemigo energia enero enfadar enfermera enfermedad enfermo enfocar enfrentar enfriar engañar engaño
engrudo enigma enlazar enojar enorme ensalada ensayar ensayo enseñar ensuciar entender enterar entero
enterrar entonces entrada entrar entraña entregar entrenar entretener entrevista entusiasmo enumerar
envase envejecer enviar envidia envolver epica epidemia epidermis epilogo epoca equilibrio equipaje
equipo equis equivocar era erguir erizo ermita erosion errar error esbelto escabullir escala escalar
escalera escalofrio escama escandalo escanear escapar escaparate escarabajo escarcha escarlata escasez
escaso escena escenario esceptico esclavo escoba escoger escolta esconder escopeta escorpion escote
escribir escrito escritor escritorio escritura escuchar escudo escuela esculpir escultura escupir esencia
esfera esfuerzo esgrima eslabon esmalte esmeralda esmero espada espalda espantar espanto esparrago
espacio espacial esparcir especial especie especifico espectaculo espectro especular expedicion espejo
esperanza esperar espeso espia espiga espina espiral espiritu esplendor esponja esposa esposo espuma
esqueleto esquiar esquina establo establecer estacion estadio estado estafa estallar estambre estampa
estanque estante estaño estar estatua estatura este estepa esteril estetica estilo estima estimular
estio estirar esto estofado estomago estorbar estornudo estrecho estrella estremecer estrenar estres
estribo estricto estrofa estructura estruendo estudiante estudiar estudio estufa estuche etapa eterno
etica etiqueta etnia eucalipto euforia europa evacuar evadir evaluar evangelio evaporar evento eventual
evidencia evitar evolucion exacto exagerar examen examinar excavar exceder excelente excepto exceso
excitar exclamar exclusivo excursion excusa exhalar exhibir exigir exilio existir exito exótico expandir
expectativa expedicion experiencia experto explicar explorar explosion explotar exponer exportar expresar
expresion exprimir expulsar exquisito extasis extender extension exterior externo extinguir extra extraer
extranjero extraño extraordinario extraviar extremo
fabula fabricar fabuloso faccion facil facilitar factura facultad faja falda falla fallar fallo falso
falta faltar fama familia famoso fanatico fandango fango fantasma fantasia faro farol farmacia fascinar
fase fastidio fatal fatiga fauna favor favorito fe febril febrero fecha fecundo federacion felicidad
feliz felpa feo feria ferocidad feroz fertil fervor festejar festin feto fiambre fianza fibra ficcion
ficha fideo fiebre fiel fiera fiesta figura fijar fijo fila filamento filete filo filosofia filtro fin
final financiar finca fingir fino firma firmar firme fiscal fisica fisico flaco flauta flecha flexible
flojo flor florero flotar fluido fluir fluor fobia foca foco folclore folleto fomentar fondo fonetica
fontanero forastero forcejear forma formal formar formula formulario foro forraje forro fortalecer
fortaleza fortuna forzar fosa fosforo fosil foto fotografia fraccion fractura fragancia fragil fragmento
fraile frambuesa franco franela franja franquear frasco frase fraude frazada frecuencia frecuente fregar
freir freno frente fresa fresco fresno frijol frio frito frivolidad frondoso frontera frotar fruta fruto
fuego fuente fuera fuerte fuerza fuga fugaz fumar funcion funda fundar fundir furgon furia furioso fusil
fusion futbol futuro
gaban gabinete gacela gafa gaita gajo galaxia galeria galgo gallina gallo galon galopar gamba gamuza
gana ganador ganado ganar gancho ganso garaje garantia garbanzo garganta garra garrafa garrapata garrote
gas gasa gasolina gastar gasto gatear gatillo gato gavilan gaviota gelatina gemelo gemido gemir gen
generacion general generar genero generoso genetica genio gente geografia geologia geometria geranio
gerente germen gesto gigante gimnasia girar girasol giro gitano glaciar gladiador glandula globo gloria
gloton globero gobernante gobernar gobierno gol goleada golfo golpe golpear goma gordo gorila gorra
gorro gorrion gota gotear gozar gozo grabacion grabar gracia gracioso grada grado graduado grafico
gramatica gramo granada grande granero granito granizo granja grano grasa gratitud gratis grato grava
grave gravedad graznar greca gremio grieta grifo grillo gris gritar grito grosero grua grueso gruñir
grupo gruta guacamole guante guapo guardar guardia guarida guerra guerrero guepardo guia guiar guijarro
guillotina guiño guion guirnalda guisante guiso guitarra gusano gustar gusto
haba habilidad habitacion habitante habitar habito habitual hablar hace hacha hacienda hada halcon
hallar hallazgo hamaca hambre hambriento hamburguesa harina harpa harto hasta hay haya hazaña hebilla
hechizo hectarea helado helecho helice helicoptero helio hembra hemisferio hemorragia hendidura heno
heraldo herbario heredar heredero herencia herida herir hermana hermano hermoso heroe herradura herramienta
herreria herrero hervir hiedra hiel hielo hiena hierba hierro higado higo higuera hija hijo hilar hilera
hilo himno hinchar hinojo hipnosis hipo hipocresia hipopotamo hipoteca hipotesis hiriente histeria
historia historiador hocico hogar hoguera hoja hojaldre hola holanda holgazan hombre hombro homenaje
homicidio hondo honesto hongo honor honra hora horario horda horizonte hormiga hormigon hormona horno
horoscopo horquilla horrible horror hortaliza hospital hostil hotel hoy hoyo hoz hueco huelga huella
huerfano huerta huerto hueso huesped huevo huida huir humanidad humano humedo humilde humillar humo
humor hundir huracan huron hurtar huso
icono idea ideal identico identidad identificar idioma idiota idolo iglesia iglu ignorancia ignorar
igual iguana ilegal ileso ilusion ilustrar imagen imaginar iman imitar impaciente impacto impar imparcial
impedir imperio impetu implicar imponente imponer importar imposible imprenta impresion impresionante
imprimir improvisar impulsar impulso impuesto impune inaugurar incapaz incendio incienso inclinar incluir
incluso incomodo incondicional inconsciente incorporar increible incubar indicar indice indio individuo
indole indomable industria inercia infancia infantil infeccion infeliz inferior inferir infierno infinito
inflamar inflar influencia informar informe infortunio ingenieria ingeniero ingenio ingenuo ingle
ingrediente ingreso iniciar inicio injusto inmediato inmenso inmune inmutable innovar inocente inodoro
inquieto inquilino insecto insertar insigne insipido insistir insolito insomnio inspeccion inspirar
instalar instante instinto institucion instituto instruccion instrumento insulina insulto intacto
integrar intelecto inteligencia inteligente intencion intentar intento interactuar interes interior
intermedio internacional internet interpretar interprete intervalo intervenir intestino intimidad intimo
intriga introducir intuicion inundacion inutil invadir invalido invasion inventar invento invierno
invisible invitar inyeccion ir ira iris ironia isla iman italia itinerario izquierda
jabali jabon jaca jacinto jade jaguar jamas jamon jaque jarabe jardin jardinero jarra jarron jaula
jazmin jefe jengibre jerga jeringa jeroglifico jinete jirafa jiron jocoso jornada joven joya joyeria
jubilar jubilo judicial juego juevesuez jugador jugar jugo juguete juicio julio junco jungla junio
juntar junto juramento jurar jurado jurisdiccion justo justicia juventud juzgar
kilo kilogramo kilometro kimono kiosco kiwi koala
laberinto labio labor laboratorio labrar laca lacayo lacio ladera lado ladrar ladrillo ladron lagartija
lagarto lago lagrima laguna laico lama lamer lamina lampara lana lancha lanza lanzar lapida lapiz
largo laringe larva lastima lastimar lata latigo latin latir latitud laton laurel lazo leal lealtad
leccion leche lechuga lechuza lectura leer legado legal legaña leyenda legible legion legítimo legua
legumbre lejano lejos lengua lenguaje leña leñador leon leopardo lepra lerdo lesion letal letra letrero
levantar leve levitar ley leyenda liar libelula liberal libertad libre libreria libro licencia licor
lider lidiar liebre lienzo liga ligero lija lima limite limon limosna limpiar limpio linaje lince
lindero lindo linea linfa lingote linterna lio liquido lira lirio lisiado liso lista listo litera
literatura litio litro liviano llaga llama llamar llano llanta llanto llave llevar llorar llover lluvia
lobo lobulo local localizar loco locomotora locutor lodo logica logico lograr logro loma lomo lona
longitud lonja loro losa loteria loza lubricar lucero lucha luchar lucido luciernaga lucro luego lugar
lujo lujuria lumbre luna lunar lunes lupa lustro luto luz
maceta machacar macho madera madrastra madre madriguera madrina madrugada madurar maduro maestro mafia
magia magico magistrado magnate magnesio magnetismo magnifico mago magro maiz majestad mal maldad
maldicion maleta maleza maligno malla maltratar malvado mama mamifero manada manantial mancha manchar
mandar mandarina mandato mandibula mando maneiro manejar manejo manera manga manguera mani mania
manifestar maniobra manipular mano manojo mansedumbre mansion manta manteca mantel mantener mantequilla
manto manual manzana mañana mapa mapache maqueta maquillaje maquina maquinaria mar maraña maravilla
marca marcar marcha marchar marchitar marco marea mareo marfil margarita margen marido marioneta
mariposa mariquita marisco marmol marron martes martillo martir marzo mas masa masaje mascara mascota
masculino masticar mastil mata matar mate matematica materia material maternal matiz matorral matrimonio
matriz maullar maximo mayo mayor mayoria maza mazmorra mazorca mecer mecha medalla media medianoche
mediante medicina medico medida medio mediodia medir meditar medusa mejilla mejor mejorar melancolia
melena melocoton melodia melon membrana membrete memoria mendigo menor menos mensaje mensajero mente
mentira menton menu menudo mercado mercancia merced mercurio merengue merienda merito mermelada mero
mes mesa meseta meson meta metafora metal meteoro meter metodo metralla metro mezcla mezclar mezquita
mi miedo miel miembro mientras miga migaja migracion mil milagro milenio militar milla millon mimar
mimbre mina mineral minero minimo ministerio ministro minoría minuto mio miope mirar mirlo mirra misa
miseria misericordia misil mision mismo mitad mitigar mito mitologia mixto mochila moda modales modelo
moderar moderno modesto modificar modo moho mojar molde moler molestar molestia molino molusco momento
momia monarca monasterio moneda monja mono monopolio montaña monte monton monumento morada morado moral
morar morder mordisco moreno morir moro morral morro mortal mortero mosca mosquito mostaza mostrar
motin motivo motor mover movimiento mozo mucho mudar mudo mueble muela muelle muerte muerto muestra
mujer muleta multa multiplicar multitud mundo muñeca muñeco muralla murcielago murmullo muro musculo
museo musica musico musgo muslo mutuo muy
nabo nacar nacer nacimiento nacion nacional nada nadar nadie naipe nalga naranja nariz narrar nasal
nata natacion nativo natural naturaleza naufragio navaja naval nave navegar navidad neblina nebulosa
necesario necesidad necesitar necio negar negativo negligencia negociar negocio negro nervio nervioso
neto neumatico neurona neutral neutro nevada nevar nevera nexo nicho nido niebla nieto nieve ninguno
niña niñez niño niñera nivel no noble nobleza nocion noche nocivo nodo nogal nomada nombrar nombre
norma normal norte nostalgia nota notar noticia novato novedad novela noveno novia noviembre novio
nube nuca nucleo nudillo nudo nuera nuestro nueve nuevo nuez nulo numero numeroso nunca nutria nutrir
ñandu ñoño
oasis obediencia obedecer obelisco obeso obispo objetar objetivo objeto oblicuo obligar obra obrero
obsequio observar obsesion obstaculo obtener obvio ocasion occidente oceano ochenta ocho ocio ocioso
octavo octubre ocultar oculto ocupar ocurrir oda odiar odio odisea oeste ofender ofensa oferta oficial
oficina oficio ofrecer oido oir ojala ojo ola oleaje oler olfato olivo olla olmo olor olvidar olvido
ombligo omitir omnibus onda ondear onza opaco opcion opera operacion operar opinion opinar opio oponer
oportunidad oprimir optica optimista opuesto oracion orador oral orangutan orbita orden ordenar ordeñar
ordinario oreja organico organismo organo orgullo orientar oriente origen original orilla orina ornamento
oro orquesta ortiga ortografia oruga osadia osar oscilar oscuro oso ostra ostentar otoño otorgar otro
ovario oveja ovillo ovni oxido oxigeno oyente ozono
pabellon paciencia paciente pacifico pacto padecer padrastro padre padrino paella pagar pagina pago
pais paisaje paja pajaro pala palabra palacio paladar palanca palco palido palma palmera palo paloma
palpar palpitar pampa pan panaderia panadero panal panda pandilla panel panico pantalon pantalla pantano
pantera pantorrilla panza pañal paño pañuelo papa papagayo papaya papel papeleta papila paquete par
para paracaidas parada paradoja paraiso paralelo paralisis parametro paraguas paraiso parcela parche
parcial pardo parecer pared pareja parentesco pariente parir parlamento paro parpado parque parrafo
parrilla parroquia parte participar particula particular partida partido partir parto pasa pasado pasaje
pasajero pasaporte pasar pasatiempo pascua pasear paseo pasillo pasion paso pasta pastel pastilla pasto
pastor pata patada patata patinar patio pato patria patron pausa pauta pavo payaso paz peaje peatón
peca pecado pecar pecho pedal pedazo pedir pedrada pegar peinar peine pelaje pelar peldaño pelea pelear
pelicano pelicula peligro peligroso pelo pelota peluca peluqueria pena penacho pendulo penetrar peninsula
pensamiento pensar pension peor pepino pequeño pera percha perder perdida perdon perdonar perdurar
perecer peregrino perejil pereza perezoso perfeccion perfecto perfil perforar perfume pergamino pericia
periodico periodo peripecia perjudicial perla permanecer permiso permitir permuta perno pero perro
perseguir persiana persona personaje personal perspectiva persuadir pertenecer pertiga perturbar perverso
pesa pesado pesar pesca pescado pescador pescar pescuezo pesebre pesimo peso pestaña peste petalo
peticion petroleo pez pezuña piano piar picadura picante picar picaro pico picor pie piedad piedra
piel pierna pieza pijama pilar pildora piloto pimiento pinar pincel pinchar pincho pinguino pino
pintar pintor pintura pinza piña piojo pipa piramide pirata pirueta pisada pisar piso pista pistola
piston pita pitar piton pizarra pizca placa placer plan plancha planchar planeta planicie plano planta
plantar plantilla plastico plata plataforma platano plateado platillo plato playa plaza plazo plegar
pleito plenitud pleno pliego pliegue plomo pluma poblacion poblar pobre pobreza pocion poco podar poder
poderoso podrido poema poesia poeta polar polea polemica polen policia poligono polilla politica politico
poliza pollo polo polvo polvora pomada pomo pomulo poncho poner poniente pontifice popa popular poquito
porcelana porcion poro porque portal porte portero portico porvenir posada posar poseer posesion posible
posicion positivo posta postal poste postigo postre postura potasio potente potro pozo practica practicar
pradera prado precaucion precio precioso precipicio preciso precoz predicar predominar preferir pregunta
preguntar pregonar prejuicio preliminar premio prenda prender prensa preocupar preparar presa presagio
presencia presente preservar presidente presion presionar preso prestar prestamo prestigio presumir
presupuesto presunto pretender pretexto prevalecer prevenir previo prever primavera primero primo
princesa principal principe principio pringar prisa prision prisionero prisma privado privar privilegio
probable probar problema proceder proceso proclamar procurar prodigio produccion producir producto
profano profecia profesion profesor profeta profundo programa progresar progreso prohibir projimo
prologo prolongar promedio promesa prometer promover promulgar pronombre pronto pronunciar propagar
propiciar propiedad propio proponer proporcion proposito propuesta prosa proseguir prosperar prostata
proteger proteina protesta protocolo provecho proveer provenir proverbio provincia provision provocar
proximo prudencia prueba publicar publico puchero pueblo puente puerco puerro puerta puerto pues puesto
pugna pulga pulgar pulir pulmon pulpa pulpo pulsar pulsera pulso pulverizar puma punta puntapie puntero
puntilla punto puntual punzar puñado puñal puño pupila pupitre pure pureza purgar purpura pus
que quebrar quedar queja quejar quemar querer querido queso quien quieto quijada quimera quimica quimico
quince quinientos quiosco quitar quiza
rabano rabia rabo racimo racion radar radiacion radiador radio rafaga raiz raja rajar rama ramo rana
rancho rango ranura rapido raqueta raro rascar rasgar rasgo rasguño raso raspar rastro rata ratear
raton rato raya rayar rayo raza razon rebaño rebajar rebanada rebelde rebosar rebotar rebuznar recado
recaer recamara recelo recepcion receptor receta rechazar recibir recibo reciclar recien reciente
recinto recitar reclamar reclinar recluir recluta recobrar recoger recomendar recompensar reconciliar
reconocer reconstruir recordar recorrer recorte recostar recreo rectangular recto recuerdo recuperar
recurrir recurso red redaccion redactar redentor redimir redondo reducir reemplazo referir reflejar
reflejo reforma refran refresco refrigerador refugio regalar regalo regañar regar regata regimen region
regir registrar registro regla reglamento regocijo regresar regreso regular reina reinado reinar reino
reir relacion relajar relampago relato relevar relieve religion religioso relinchar reloj remar rematar
remedio remendar remesa remolino remolque remordimiento remoto remover rencor rendija rendir renegar
reno renovar renunciar reñir reparar repartir repasar repecho repente repetir repicar repisa replegar
repleto replica replicar repollo reponer reportaje reposar reposo represa representar reprimir reproche
reptil republica repudiar repulsivo reputacion requerir requisito res resaca resaltar resbalar rescatar
rescate reseco reseña reserva resfriado resguardar residir residuo resignar resina resistir resolver
resonar resoplar resorte respaldar respaldo respetar respeto respirar resplandor responder responsable
respuesta restar restaurar resto resucitar resultado resultar resumen resumir retar retazo retener
retina retirar retiro retorcer retoño retorno retrato retrete retroceder retumbar reunion reunir revelar
reventar reverencia reverso revés revisar revista revolcar revolotear revolucion revolver rey rezar rezo
riachuelo ribera rico ridiculo riego rienda riesgo rifle rigido rigor rincon rinoceronte riña riñon rio
riqueza risa ritmo rito ritual rival rizar rizo roble robot robusto roca roce rociar rocio rodar rodear
rodilla rodillo roer rogar rojo rollo romance romano romero romper ron roncar ronco ronda rondar ropa
ropero rosa rosal rosca roseta rostro rotar roto rotulo rozar rubi rubio rudo rueda ruego rugido rugir
ruibarbo ruido ruina ruiseñor rulo rumbo rumiar rumor ruptura rural ruta rutina
sabado sabana saber sabiduria sabio sabor sabroso sacar sacerdote saciar saco sacramento sacrificio
sacudir saeta sagaz sagrado sahara sal sala salado salamandra salario salchicha saldo salida salir
saliva salmon salon salpicar salsa saltar saltamontes salto salud saludable saludar saludo salvar salvia
sanar sandalia sandia sanear sangre sangrar sano santo saña sapo saqueo sarampion sarcasmo sardina
sargento sarten sastre satelite satira satisfaccion sauce sauco savia saxofon sazon secar seccion seco
secreto secta sector secuencia secuestrar seda sedal sediento seducir segar segmento seguir segun
segundo seguridad seguro seis seleccion selecto sello selva semana semblante sembrar semejante semen
semestre semilla seminario sencillo senda sendero seno sensacion sensible sentencia sentir señal señalar
señor señora señorita separar sepulcro sepultura sequia ser serenata sereno serie serio sermon serpiente
serrucho servicio servidor servir sesenta sesgo sesion seso seta setenta setiembre seto severo sexo
sexto siembra siempre sien siervo sierra siesta siete siglo significado significar signo siguiente
silaba silbar silbato silencio silueta silvestre sima simbolo simetria simio simpatia simple simular
simultaneo sincero sindicato sinfonia singular sino sintoma cintura sinuoso siquiera sirena sistema
sitio situacion sobaco sobar soberano soberbia soborno sobra sobrar sobre sobrecarga sobrino social
sociedad socio socorro soda sodio sofa soga sol solamente solapa solar soldado soldar soledad solemne
soler solicitar solido solitario solo soltar soltero solucion sollozar sombra sombrero someter somnoliento
sonaja sonar sonda sondear sonido sonreir sonrisa sonrojo soñar sopa soplar soplo soportar soporte
sorbo sordo sorprender sorpresa sorteo sortija sosegar sospecha sostener sotano su suave subir subito
submarino subrayar subscribir subsistir sustancia sustituir susto sutil suyo
tabaco taberna tabique tabla tablero tablon taburete tacaño tacha tachar tacon tactica tacto tahur
tajada taladro talar talon taller tallo tamal tamaño tambalear tambien tambor tamiz tampico tampoco
tanque tanto tapa tapar tapete tapia tapiz tapon tardar tarde tarea tarifa tarima tarjeta tarro tarta
tartamudo tasa tasca tatuaje tauro taza tazon te teatro tecla teclado tecnica tecnico tedio teja tejado
tejer tejido tela telaraña telefono telescopio televisor telon tema temblar temblor temer temerario
temor tempestad templo temporada temprano tenaz tenaza tender tendido tendon tenedor tener teniente
tenis tension tentar tentativa teñir teoria tercio terciopelo terco terminar termino termo termometro
ternera ternura terraza terremoto terrible territorio terror tesis tesoro testamento testigo testimonio
teta tetera tez ti tia tibio tiburon tiempo tienda tierno tierra tieso tigre tijera tilde timbal timbrar
timbre timido timon tina tiniebla tinta tintero tinto tio tipico tipo tira tirano tirar tirita tiro
tiron titan titere titubear titulo tiza tizon toalla tobillo tobogan tocar tocino todavia todo toga
toldo tolerar tomar tomate tomillo tonada tonelada tonto topar tope topografia torax torcer torcido
tormenta tormento tornar torneo tornillo toro toronja torpe torpeza torre dorso tortuga tos toser tosco
tostada tostadora total totora toxina trabajar trabajo tractor tradicion traduccion traducir traer
trafico tragar tragedia trago traicion traer traje trampa tramo tranca tranquilo transaccion transcurrir
transferir transformar transito transmitir transparente transportar trapecio trapo traquea tras trasero
trasladar traspasar trasto trastorno tratado tratar trato trauma travesia travieso trayecto trazar trazo
trebol trece tregua treinta tremendo tren trenza trepar tres tribu tribunal tributo trigo trillar trinar
trinchera trineo trinidad trio tripa triple tripulacion triste tristeza triturar triunfo trofeo tromba
trompa trompeta tronco trono tropa tropezar tropical tropico trotar trote trozo truco trueno trueque
trufa tubo tucan tuerca tuerto tuetano tulipa tulipan tumba tumbar tumor tumulto tuna tunel tunica
tupido turba turbio turbina turismo turista turno turquesa tutor tuyo
ubicar ubre ufano ulcera ultimo ultraje umbral unanime uncir ungir unico unidad unir universal universo
uno untar uña urbano urbe urdir urgente urna urraca usar uso usted usual usurpar utensilio util utilizar
utopia uva
vaca vacaciones vaciar vacilar vacio vacuna vagar vago vaina vainilla vajilla vale valer valiente
valija valido valle valor valvula vampiro vanidad vano vapor vaquero vara varar variable variar varilla
varon vasija vaso vastago vasto vaticinar vecino vector vedar vega vegetacion vegetal vehiculo veinte
vejez vejiga vela velar veleta vello velo velocidad veloz vena venado vencedor vencer venda vendar
vendaval vender veneno venerar venganza vengar venir venta ventaja ventana ventilar vientre venus ver
verano veraz verbo verdad verdadero verde verdugo verdura vereda vergel verguenza verificar verja verso
verter vertical vertigo vesicula vestido vestigio vestir veta veterano vez via viajar viaje viajero
vianda vibora vibrar vicio victima victoria vid vida vidrio vieja viejo viento vientre viernes viga
vigilar vigor vihuela vil villa vinagre vinculo vino viola violar violencia violento violeta violin
virar virgen viril virtud virus viscoso visita visitar vislumbrar vispera vista vistazo visto viuda
viudo vivienda vivir vivo vizconde vocablo vocacion vocal vocear volar volcan volcar volumen voluntad
volver vomitar voraz votar voto voz vuelo vuelta vuestro vulgar vulnerable
wafle whisky
xilofono
yacer yate yegua yema yerno yeso yodo yoga yogur yugo yunque yuxtaposicion
zafiro zanja zanahoria zapatero zapatilla zapato zarandeo zarpa zarpar zarza zarzamora zigzag zinc
zocalo zona zoologico zorro zozobra sueco zumbido zumo zurcir zurdo
"""


def build_spanish_lexicon(extra_words: set[str] | None = None) -> list[str]:
    """
    Construye una lista ordenada y deduplicada de palabras válidas del español
    combinando el vocabulario raíz, sus flexiones regulares y todos los términos
    de los desafíos de ÓRBITA.
    """
    vocab: set[str] = set()
    for raw_token in _SPANISH_ROOT_VOCAB.split():
        norm = normalize_word(raw_token)
        if len(norm) >= 2:
            vocab.update(generate_inflections(norm))
            # Si es infinitivo verbal (-ar/-er/-ir), añadir participio y gerundio estándar
            if len(norm) >= 4 and norm.endswith("ar"):
                stem = norm[:-2]
                vocab.update({stem + "ado", stem + "ada", stem + "ados", stem + "adas", stem + "ando"})
            elif len(norm) >= 4 and norm.endswith(("er", "ir")):
                stem = norm[:-2]
                vocab.update({stem + "ido", stem + "ida", stem + "idos", stem + "idas", stem + "iendo"})

    if extra_words:
        for w in extra_words:
            nw = normalize_word(w)
            if len(nw) >= 2:
                vocab.update(generate_inflections(nw))

    return sorted(vocab)


def export_lexicon_file(output_path: Path, extra_words: set[str] | None = None) -> int:
    words = build_spanish_lexicon(extra_words)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(words) + "\n", encoding="utf-8")
    return len(words)
