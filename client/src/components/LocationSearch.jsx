export default function LocationSearch({ label, value, onChange, placeholder }) {
  return (
    <div className="location-search">
      <label className="label">{label}</label>
      <input 
        className="input" 
        value={value} 
        onChange={e => onChange && onChange(e.target.value)} 
        placeholder={placeholder} 
      />
    </div>
  );
}
