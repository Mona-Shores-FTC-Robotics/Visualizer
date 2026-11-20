// The "Our Auto beside a partner" page (partner.html): its own small app, so a phone loads only
// the preview, not the editor.
import { mount } from "svelte";
import PartnerPage from "./PartnerPage.svelte";

export default mount(PartnerPage, { target: document.body });
