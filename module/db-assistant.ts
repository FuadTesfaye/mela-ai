class DBAssistant extends HTMLElement {connectedCallback(){if(!this.shadowRoot)this.attachShadow({mode:"open"}).innerHTML="<button>Ask MELA</button>";}}
if(!customElements.get("db-assistant"))customElements.define("db-assistant",DBAssistant);
