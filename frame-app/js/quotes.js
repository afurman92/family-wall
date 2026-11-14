// Lines for the night screen. Local on purpose: no API key, no rate limit, no
// network dependency at 3 a.m. Short enough to read half-asleep, and all
// attributable to a real author — a wall that invents quotes is worse than a
// wall with no quotes.
window.QUOTES = [
  // Cervantes
  { t: 'La libertad, Sancho, es uno de los más preciosos dones que a los hombres dieron los cielos.', a: 'Cervantes' },
  { t: 'No hay libro tan malo que no tenga algo bueno.', a: 'Cervantes' },
  { t: 'El que lee mucho y anda mucho, ve mucho y sabe mucho.', a: 'Cervantes' },
  { t: 'Donde hay música no puede haber cosa mala.', a: 'Cervantes' },

  // Shakespeare
  { t: 'Ser o no ser: esa es la cuestión.', a: 'Shakespeare' },
  { t: 'El mundo entero es un escenario, y todos los hombres y mujeres son meros actores.', a: 'Shakespeare' },
  { t: 'Somos de la misma materia que los sueños, y nuestra breve vida está rodeada de un sueño.', a: 'Shakespeare' },
  { t: 'Nada es bueno ni malo, sino que el pensamiento lo hace así.', a: 'Shakespeare' },
  { t: 'Lo que llamamos rosa olería igual con cualquier otro nombre.', a: 'Shakespeare' },

  // Siglo XIX
  { t: 'Soy vasto, contengo multitudes.', a: 'Walt Whitman' },
  { t: 'La esperanza es esa cosa con plumas que se posa en el alma.', a: 'Emily Dickinson' },
  { t: 'Durante casi toda la historia, «anónimo» fue una mujer.', a: 'Virginia Woolf' },
  { t: 'Fui a los bosques porque quería vivir deliberadamente.', a: 'Thoreau' },
  { t: 'Las cosas no cambian; cambiamos nosotros.', a: 'Thoreau' },
  { t: 'Nada grande se ha logrado nunca sin entusiasmo.', a: 'Emerson' },
  { t: 'Sé tú mismo: los demás puestos ya están ocupados.', a: 'Oscar Wilde' },
  { t: 'Todo arte es completamente inútil.', a: 'Oscar Wilde' },
  { t: 'Dentro de veinte años estarás más decepcionado por lo que no hiciste que por lo que hiciste.', a: 'Mark Twain' },
  { t: 'La verdad es lo más valioso que tenemos. Economícémosla.', a: 'Mark Twain' },
  { t: 'No hay encanto como la bondad de corazón.', a: 'Jane Austen' },
  { t: 'La felicidad en el matrimonio es enteramente cuestión de suerte.', a: 'Jane Austen' },

  // Siglo XX
  { t: 'Un libro debe ser el hacha que rompa el mar de hielo que llevamos dentro.', a: 'Franz Kafka' },
  { t: 'Quizá todo terror no sea, en el fondo, más que algo indefenso que pide nuestra ayuda.', a: 'Rainer Maria Rilke' },
  { t: 'Navegar es necesario; vivir no es necesario.', a: 'Fernando Pessoa' },
  { t: 'Lo esencial es invisible a los ojos.', a: 'Antoine de Saint-Exupéry' },
  { t: 'Uno no es lo que es por lo que escribe, sino por lo que ha leído.', a: 'Jorge Luis Borges' },
  { t: 'La vida no es la que uno vivió, sino la que uno recuerda y cómo la recuerda.', a: 'Gabriel García Márquez' },
  { t: 'Andábamos sin buscarnos, pero sabiendo que andábamos para encontrarnos.', a: 'Julio Cortázar' },

  // Españoles
  { t: 'Caminante, no hay camino: se hace camino al andar.', a: 'Antonio Machado' },
  { t: 'Todo necio confunde valor y precio.', a: 'Antonio Machado' },
  { t: 'La mayor cosa del mundo es saber ser uno mismo.', a: 'Montaigne' },
  { t: 'Nada es tan contagioso como el ejemplo.', a: 'Montaigne' },

  // Clásicos
  { t: 'No es que tengamos poco tiempo, es que perdemos mucho.', a: 'Séneca' },
  { t: 'Mientras esperamos vivir, la vida pasa.', a: 'Séneca' },
  { t: 'Tienes poder sobre tu mente, no sobre los acontecimientos.', a: 'Marco Aurelio' },
  { t: 'La felicidad de tu vida depende de la calidad de tus pensamientos.', a: 'Marco Aurelio' },
  { t: 'Un viaje de mil millas comienza con un solo paso.', a: 'Lao Tse' },
  { t: 'El que sabe no habla; el que habla no sabe.', a: 'Lao Tse' },
  { t: 'Nadie se baña dos veces en el mismo río.', a: 'Heráclito' },
  { t: 'No es tanto lo que tenemos, sino cómo lo disfrutamos.', a: 'Epicuro' },,

  // English — the house speaks both
  { t: 'The fault, dear Brutus, is not in our stars, but in ourselves.', a: 'Shakespeare' },
  { t: 'There is nothing either good or bad, but thinking makes it so.', a: 'Shakespeare' },
  { t: 'We are such stuff as dreams are made on.', a: 'Shakespeare' },
  { t: 'This above all: to thine own self be true.', a: 'Shakespeare' },
  { t: 'The course of true love never did run smooth.', a: 'Shakespeare' },
  { t: 'I am large, I contain multitudes.', a: 'Walt Whitman' },
  { t: 'Hope is the thing with feathers that perches in the soul.', a: 'Emily Dickinson' },
  { t: 'Forever is composed of nows.', a: 'Emily Dickinson' },
  { t: 'A woman must have money and a room of her own if she is to write fiction.', a: 'Virginia Woolf' },
  { t: 'Nothing great was ever achieved without enthusiasm.', a: 'Emerson' },
  { t: 'I went to the woods because I wished to live deliberately.', a: 'Thoreau' },
  { t: 'Be yourself; everyone else is already taken.', a: 'Oscar Wilde' },
  { t: 'We are all in the gutter, but some of us are looking at the stars.', a: 'Oscar Wilde' },
  { t: 'All art is quite useless.', a: 'Oscar Wilde' },
  { t: 'There is no charm equal to tenderness of heart.', a: 'Jane Austen' },
  { t: 'Call me Ishmael.', a: 'Herman Melville' },
  { t: 'A book must be the axe for the frozen sea within us.', a: 'Franz Kafka' },
  { t: 'Perhaps everything terrible is, in its deepest being, something helpless that wants help from us.', a: 'Rainer Maria Rilke' },
  { t: 'The best way out is always through.', a: 'Robert Frost' },
  { t: 'In three words I can sum up everything I have learned about life: it goes on.', a: 'Robert Frost' },
  { t: 'The world breaks everyone, and afterward many are strong at the broken places.', a: 'Ernest Hemingway' },
  { t: 'So we beat on, boats against the current, borne back ceaselessly into the past.', a: 'F. Scott Fitzgerald' },
  { t: 'Only those who will risk going too far can possibly find out how far one can go.', a: 'T. S. Eliot' },
  { t: 'You have power over your mind, not outside events. Realize this, and you will find strength.', a: 'Marcus Aurelius' },
  { t: 'The happiness of your life depends upon the quality of your thoughts.', a: 'Marcus Aurelius' },
  { t: 'We are more often frightened than hurt; we suffer more from imagination than from reality.', a: 'Seneca' },
  { t: 'It is not that we have a short time to live, but that we waste a lot of it.', a: 'Seneca' },
  { t: 'A journey of a thousand miles begins with a single step.', a: 'Lao Tzu' },
  { t: 'Knowing others is intelligence; knowing yourself is true wisdom.', a: 'Lao Tzu' },
  { t: 'No man ever steps in the same river twice.', a: 'Heraclitus' },
];
