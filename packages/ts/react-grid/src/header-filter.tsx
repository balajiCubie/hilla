import { DatePicker, DatePickerElement, type DatePickerI18n } from '@hilla/react-components/DatePicker.js';
import { Item } from '@hilla/react-components/Item.js';
import { ListBox } from '@hilla/react-components/ListBox.js';
import { NumberField } from '@hilla/react-components/NumberField.js';
import { Select, type SelectElement } from '@hilla/react-components/Select.js';
import { TextField, type TextFieldElement } from '@hilla/react-components/TextField.js';
import { TimePicker } from '@hilla/react-components/TimePicker.js';
import { useContext, useEffect, useRef, useState, type ReactElement, type RefObject } from 'react';
import { ColumnContext } from './autogrid-column-context.js';
import { DateFormatter } from './date-formatter';
import { defaultLocale } from './i18n.js';
import Matcher from './types/dev/hilla/crud/filter/PropertyStringFilter/Matcher';

// TODO: Replace with more robust solution
const autoGridFilterWithLessGreaterEqualsStyle = document.createElement('style');
autoGridFilterWithLessGreaterEqualsStyle.id = 'autoGridFilterWithLessGreaterEquals';
autoGridFilterWithLessGreaterEqualsStyle.textContent = `
.${autoGridFilterWithLessGreaterEqualsStyle.id} {
  --vaadin-field-default-width: 2em;
  margin-right: 3px;
}
.${autoGridFilterWithLessGreaterEqualsStyle.id} > vaadin-select-value-button {
  --_lumo-text-field-overflow-mask-image: none !important;
}

.${autoGridFilterWithLessGreaterEqualsStyle.id}::part(toggle-button) {
  display: none;
}`;
document.head.appendChild(autoGridFilterWithLessGreaterEqualsStyle);

// Create date picker I18N config based on the current browser locale
const dateFormatter = new DateFormatter(defaultLocale);

const datePickerI18n: DatePickerI18n = {
  ...new DatePickerElement().i18n,
  formatDate: (date) => dateFormatter.format(date),
  parseDate: (text) => dateFormatter.parse(text) ?? undefined,
};

function useFilterState(initialMatcher: Matcher) {
  const context = useContext(ColumnContext)!;
  const [matcher, setMatcher] = useState(initialMatcher);
  const [filterValue, setFilterValue] = useState('');

  function updateFilter(newMatcher: Matcher, newFilterValue: string) {
    setFilterValue(newFilterValue);
    setMatcher(newMatcher);

    const filter = {
      propertyId: context.propertyInfo.name,
      filterValue: newFilterValue,
      matcher: newMatcher,
    };
    // eslint-disable-next-line
    (filter as any).t = 'propertyString';
    context.setPropertyFilter(filter);
  }

  return { matcher, filterValue, updateFilter };
}

// Workaround for https://github.com/vaadin/react-components/issues/148
function useSelectInitWorkaround(selectRef: RefObject<SelectElement>) {
  useEffect(() => {
    setTimeout(() => {
      if (selectRef.current) {
        selectRef.current.requestContentUpdate();
      }
    }, 1);
  }, []);
}

// extracted component (and type) to avoid code duplication
type ComparationSelectionProps = {
  value: Matcher;
  onMatcherChanged(matcher: Matcher): void;
};

function ComparationSelection({ onMatcherChanged, value }: ComparationSelectionProps): ReactElement {
  const select = useRef<SelectElement>(null);

  useSelectInitWorkaround(select);

  return (
    <Select
      ref={select}
      value={value}
      onValueChanged={({ detail }) => {
        onMatcherChanged(detail.value as Matcher);
      }}
      renderer={() => (
        <ListBox>
          <Item value={Matcher.GREATER_THAN} {...{ label: '>' }}>
            &gt; Greater than
          </Item>
          <Item value={Matcher.LESS_THAN} {...{ label: '<' }}>
            &lt; Less than
          </Item>
          <Item value={Matcher.EQUALS} {...{ label: '=' }}>
            = Equals
          </Item>
        </ListBox>
      )}
      className={autoGridFilterWithLessGreaterEqualsStyle.id}
    ></Select>
  );
}

export function StringHeaderFilter(): ReactElement {
  const { updateFilter } = useFilterState(Matcher.CONTAINS);

  return (
    <TextField
      placeholder="Filter..."
      onInput={(e: any) => {
        const fieldValue = ((e as InputEvent).target as TextFieldElement).value;
        updateFilter(Matcher.CONTAINS, fieldValue);
      }}
    ></TextField>
  );
}

export function NumberHeaderFilter(): ReactElement {
  const { matcher, filterValue, updateFilter } = useFilterState(Matcher.GREATER_THAN);
  const select = useRef<SelectElement>(null);

  useSelectInitWorkaround(select);

  return (
    <>
      <ComparationSelection value={matcher} onMatcherChanged={(m) => updateFilter(m, filterValue)} />
      <NumberField
        placeholder="Filter..."
        onInput={(e) => {
          const fieldValue = ((e as InputEvent).target as TextFieldElement).value;
          updateFilter(matcher, fieldValue);
        }}
      />
    </>
  );
}

export function BooleanHeaderFilter(): ReactElement {
  const { filterValue, updateFilter } = useFilterState(Matcher.EQUALS);
  const select = useRef<SelectElement>(null);

  useSelectInitWorkaround(select);

  return (
    <Select
      ref={select}
      onValueChanged={(e) => {
        const newFilterValue = e.detail.value;
        updateFilter(Matcher.EQUALS, newFilterValue);
      }}
      renderer={() => (
        <ListBox>
          <Item value={''} {...{ label: '' }}></Item>
          <Item value={'True'} {...{ label: 'Yes' }}>
            Yes
          </Item>
          <Item value={'False'} {...{ label: 'No' }}>
            No
          </Item>
        </ListBox>
      )}
      value={filterValue}
    ></Select>
  );
}

export function DateHeaderFilter(): ReactElement {
  const { matcher, filterValue, updateFilter } = useFilterState(Matcher.GREATER_THAN);
  const [invalid, setInvalid] = useState(false);

  return (
    <>
      <ComparationSelection value={matcher} onMatcherChanged={(m) => updateFilter(m, filterValue)} />
      <DatePicker
        value={filterValue}
        placeholder="Filter..."
        i18n={datePickerI18n}
        onInvalidChanged={({ detail: { value } }) => {
          setInvalid(value);
        }}
        onValueChanged={({ detail: { value } }) => {
          if (!(invalid || value === filterValue)) {
            updateFilter(matcher, value);
          }
        }}
      />
    </>
  );
}

export function TimeHeaderFilter(): ReactElement {
  const { matcher, filterValue, updateFilter } = useFilterState(Matcher.GREATER_THAN);
  const [invalid, setInvalid] = useState(false);

  return (
    <>
      <ComparationSelection value={matcher} onMatcherChanged={(m) => updateFilter(m, filterValue)} />
      <TimePicker
        value={filterValue}
        placeholder="Filter..."
        onInvalidChanged={({ detail: { value } }) => {
          setInvalid(value);
        }}
        onValueChanged={({ detail: { value } }) => {
          if (!(invalid || value === filterValue)) {
            updateFilter(matcher, value);
          }
        }}
      />
    </>
  );
}

export function NoHeaderFilter(): ReactElement {
  return <></>;
}
