import studio from './assets/office-room-background.png';
import retro from './assets/world-retro-70s.png';
import arcade from './assets/world-arcade-80s.png';
import cyber from './assets/world-cyber-2000.png';

const previews = [
  { name: 'Retro 70s', image: retro, description: 'A warm office concept with amber and brown materials, vintage furniture, and a retro workspace atmosphere.' },
  { name: 'Arcade 80s', image: arcade, description: 'A playful office concept with purple and magenta accents, arcade-inspired decoration, and a darker illuminated interior.' },
  { name: 'Cyber 2000', image: cyber, description: 'A cool blue office concept with futuristic lighting and technology-inspired environmental details.' },
];

export function WorldPreviews(): React.JSX.Element {
  return <section className="worlds-section" aria-label="Worlds — current office and future previews">
    <h2 id="worlds-section-title" className="section-destination" tabIndex={-1}>Worlds</h2>
    <p className="worlds-explanation">Studio is the only authored office. Previews reveal visual concepts; they do not switch worlds.</p>
    <div className="world-gallery">
      <div className="world-entry world-current">
        <span className="world-thumbnail"><img src={studio} width={64} height={36} alt="" /></span>
        <span className="world-name">Studio</span><span className="world-status">Current</span>
      </div>
      {previews.map(world => <details className="world-entry" key={world.name}>
        <summary aria-label={`${world.name} — Preview`}>
          <span className="world-thumbnail"><img src={world.image} width={66} height={53} alt="" /></span>
          <span className="world-name">{world.name}</span><span className="world-status">Preview</span>
        </summary>
        <p className="world-description">{world.description}</p>
        <p className="worlds-explanation">Preview only. This office is not available. Studio and all agent information remain unchanged.</p>
      </details>)}
    </div>
  </section>;
}
