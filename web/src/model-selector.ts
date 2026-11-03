import type { MatrixModel } from './matrix-data.ts';
import { vendorPaint } from './matrix-brand.ts';
import { controlId } from './matrix-focus.ts';
import { groupModels, setVendorSelected, vendorSelectionState } from './matrix-selection.ts';
import { modelSelectorLayout } from './model-alignment.ts';
export const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const esc = escapeHtml;
export function renderModelSelector(
  allModels: readonly MatrixModel[],
  selected: ReadonlySet<string>,
  search: string,
  controls = 'matrix-data',
  subject = 'table',
) {
  const query = search.trim().toLowerCase();
  const layout = modelSelectorLayout(allModels);
  const groups = groupModels(allModels)
    .map((group) => ({
      ...group,
      matches: group.models.filter((model) =>
        `${model.name} ${model.vendor}`.toLowerCase().includes(query),
      ),
    }))
    .filter((group) => group.matches.length);
  return `<aside class="matrix-model-nav" aria-label="Brands and drive models" style="--matrix-model-code-width:${layout.codeWidth}ch;--matrix-model-integer-width:${layout.integerWidth}ch;--matrix-model-fraction-width:${layout.fractionWidth}ch;--matrix-model-capacity-width:${layout.capacityWidth}ch">
    <h2 class="matrix-nav-heading">Brands & models</h2>
    <p class="matrix-nav-count" role="status">${allModels.filter((model) => selected.has(model.id)).length} of ${allModels.length} models selected</p>
    <label class="matrix-nav-search">Find choices<input id="matrix-search" type="search" value="${esc(search)}" placeholder="Model or brand" aria-describedby="matrix-selection-help"></label>
    <p id="matrix-selection-help" class="matrix-nav-help">Search finds choices. Checkboxes control the ${subject}. Brand checkboxes apply to all models in that brand.</p>
    <div class="matrix-nav-actions"><button type="button" id="matrix-select-all">Select all</button><button type="button" id="matrix-clear">Clear all</button></div>
    <div class="matrix-brand-list">${
      groups
        .map((group) => {
          const state = vendorSelectionState(group.models, selected);
          return `<div class="matrix-brand-group" data-render-key="choices-${esc(group.vendor)}" style="--brand-color:${vendorPaint(group.vendor).background}"><fieldset class="matrix-brand-options"><legend><label class="matrix-vendor-choice"><input type="checkbox" id="${controlId('vendor', group.vendor)}" data-vendor="${esc(group.vendor)}" aria-controls="${esc(controls)}" ${state.checked ? 'checked' : ''}><span>${esc(group.vendor)}</span><small aria-hidden="true">${state.selectedCount}/${state.totalCount}</small></label></legend><div class="matrix-model-choices">${group.matches
            .map((model) => {
              const label = layout.labels.get(model.id)!;
              return `<label class="matrix-model-choice" data-render-key="choice-${esc(model.id)}"><input type="checkbox" id="${controlId('model', model.id)}" data-model="${esc(model.id)}" aria-controls="${esc(controls)}" ${selected.has(model.id) ? 'checked' : ''}><span class="model-id"><span class="matrix-model-code" style="padding-inline-start:${label.indent}ch">${esc(label.code)}</span> (<span class="matrix-model-capacity">${label.capacity === null ? 'capacity unknown' : `<span class="matrix-model-integer">${esc(label.integer)}</span><span class="matrix-model-fraction">${esc(label.fraction)}</span> TB`}</span>)</span></label>`;
            })
            .join('')}</div></fieldset></div>`;
        })
        .join('') || '<p class="matrix-nav-empty">No matching brands or models.</p>'
    }</div>
  </aside>`;
}
export function bindModelSelector(
  host: HTMLElement,
  models: readonly MatrixModel[],
  selected: ReadonlySet<string>,
  onSearch: (value: string) => void,
  onSelection: (next: Set<string>) => void,
) {
  host.querySelector<HTMLInputElement>('#matrix-search')!.oninput = (event) =>
    onSearch((event.target as HTMLInputElement).value);
  host.querySelector<HTMLButtonElement>('#matrix-select-all')!.onclick = () =>
    onSelection(new Set(models.map((model) => model.id)));
  host.querySelector<HTMLButtonElement>('#matrix-clear')!.onclick = () => onSelection(new Set());
  host.querySelectorAll<HTMLInputElement>('[data-vendor]').forEach((input) => {
    const members =
      groupModels(models).find((group) => group.vendor === input.dataset.vendor)?.models ?? [];
    input.indeterminate = vendorSelectionState(members, selected).indeterminate;
    input.onchange = () =>
      onSelection(setVendorSelected(models, input.dataset.vendor!, selected, input.checked));
  });
  host.querySelectorAll<HTMLInputElement>('[data-model]').forEach((input) => {
    input.onchange = () => {
      const next = new Set(selected);
      if (input.checked) {
        next.add(input.dataset.model!);
      } else {
        next.delete(input.dataset.model!);
      }
      onSelection(next);
    };
  });
}
