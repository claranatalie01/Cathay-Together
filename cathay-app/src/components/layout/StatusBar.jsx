import './StatusBar.css';

// Decorative iPhone status bar. The time is fixed to match the designs.
export default function StatusBar({ time = '15:54', transparent = false }) {
  return (
    <div className={`status-bar${transparent ? ' status-bar--transparent' : ''}`} aria-hidden="true">
      <div className="status-bar__inner">
        <div className="status-bar__wifi">
          <div className="status-bar__wifi-elements">
            <img src="/assets/b0ee8.svg" alt="" />
          </div>
        </div>
        <p className="status-bar__time">{time}</p>
        <div className="status-bar__battery">
          <div className="status-bar__battery-elements">
            <img src="/assets/87706.svg" alt="" />
          </div>
        </div>
        <div className="status-bar__signal">
          <div className="status-bar__signal-elements">
            <img src="/assets/962bc.svg" alt="" />
          </div>
        </div>
      </div>
    </div>
  );
}
