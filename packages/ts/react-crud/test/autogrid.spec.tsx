import { expect, use } from '@esm-bundle/chai';
import { GridColumn } from '@hilla/react-components/GridColumn.js';
import type { TextFieldElement } from '@hilla/react-components/TextField.js';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { AutoGrid, type AutoGridProps } from '../src/autogrid.js';
import type { CrudService } from '../src/crud.js';
import type AndFilter from '../src/types/dev/hilla/crud/filter/AndFilter.js';
import Matcher from '../src/types/dev/hilla/crud/filter/PropertyStringFilter/Matcher.js';
import type PropertyStringFilter from '../src/types/dev/hilla/crud/filter/PropertyStringFilter.js';
import type Sort from '../src/types/dev/hilla/mappedtypes/Sort.js';
import Direction from '../src/types/org/springframework/data/domain/Sort/Direction.js';
import GridController from './GridController.js';
import SelectController from './SelectController.js';
import {
  ColumnRendererTestModel,
  columnRendererTestService,
  CompanyModel,
  companyService,
  type HasTestInfo,
  type Person,
  PersonModel,
  personService,
} from './test-models-and-services.js';
import TextFieldController from './TextFieldController.js';

use(sinonChai);
use(chaiAsPromised);

export async function nextFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

async function assertColumns(grid: GridController, ...ids: string[]) {
  const columns = await grid.getColumns();
  expect(columns).to.have.length(ids.length);
  await expect(grid.getHeaderCellContents()).to.eventually.deep.equal(grid.generateColumnHeaders(ids));

  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === '') {
      expect(columns[i].path).to.equal(undefined);
    } else {
      expect(columns[i].path).to.equal(ids[i]);
    }
  }
}

describe('@hilla/react-crud', () => {
  describe('Auto grid', () => {
    function TestAutoGridNoHeaderFilters(customProps: Partial<AutoGridProps<Person>>) {
      return <AutoGrid service={personService()} model={PersonModel} noHeaderFilters {...customProps} />;
    }

    function TestAutoGrid(customProps: Partial<AutoGridProps<Person>>) {
      return <AutoGrid service={personService()} model={PersonModel} {...customProps} />;
    }

    let user: ReturnType<(typeof userEvent)['setup']>;

    beforeEach(() => {
      user = userEvent.setup();
    });

    describe('basics', () => {
      it('creates columns based on model', async () => {
        const grid = await GridController.init(render(<TestAutoGridNoHeaderFilters />), user);
        await assertColumns(grid, 'firstName', 'lastName', 'email', 'someNumber', 'vip');
      });

      it('can change model and recreate columns', async () => {
        const result = render(<AutoGrid service={personService()} model={PersonModel} />);
        await assertColumns(
          await GridController.init(result, user),
          'firstName',
          'lastName',
          'email',
          'someNumber',
          'vip',
        );
        result.rerender(<AutoGrid service={companyService()} model={CompanyModel} />);
        await assertColumns(await GridController.init(result, user), 'name', 'foundedDate');
      });

      it('sorts according to first column by default', async () => {
        const service = personService();
        const grid = await GridController.init(render(<TestAutoGridNoHeaderFilters service={service} />), user);

        const expectedSort: Sort = { orders: [{ property: 'firstName', direction: Direction.ASC, ignoreCase: false }] };
        expect(service.lastSort).to.deep.equal(expectedSort);
        await expect(grid.getSortOrder()).to.eventually.deep.equal([
          { property: 'firstName', direction: Direction.ASC },
        ]);
      });

      it('retains sorting when re-rendering', async () => {
        const result = render(<TestAutoGridNoHeaderFilters />);
        const grid = await GridController.init(result, user);

        await grid.sort('lastName', 'desc');
        await expect(grid.getSortOrder()).to.eventually.deep.equal([
          { property: 'lastName', direction: Direction.DESC },
        ]);

        result.rerender(<TestAutoGridNoHeaderFilters />);
        await expect(grid.getSortOrder()).to.eventually.deep.equal([
          { property: 'lastName', direction: Direction.DESC },
        ]);
      });

      it('creates sortable columns', async () => {
        const service = personService();
        const grid = await GridController.init(render(<TestAutoGridNoHeaderFilters service={service} />), user);
        await grid.sort('firstName', 'desc');

        const expectedSort: Sort = {
          orders: [{ property: 'firstName', direction: Direction.DESC, ignoreCase: false }],
        };
        expect(service.lastSort).to.deep.equal(expectedSort);
        await expect(grid.getSortOrder()).to.eventually.deep.equal([
          { property: 'firstName', direction: Direction.DESC },
        ]);
      });

      it('sets a data provider, but only once', async () => {
        const service = personService();
        const result = render(<TestAutoGridNoHeaderFilters service={service} />);
        let grid = await GridController.init(result, user);
        const dp = grid.instance.dataProvider;
        expect(dp).to.not.be.undefined;
        result.rerender(<TestAutoGridNoHeaderFilters service={service} />);
        grid = await GridController.init(result, user);
        expect(dp).to.equal(grid.instance.dataProvider);
      });

      it('data provider provides data', async () => {
        const grid = await GridController.init(render(<TestAutoGridNoHeaderFilters />), user);
        expect(grid.getVisibleRowCount()).to.equal(2);
        expect(grid.getBodyCellContent(0, 0)).to.have.rendered.text('Jane');
        expect(grid.getBodyCellContent(0, 1)).to.have.rendered.text('Love');
        expect(grid.getBodyCellContent(1, 0)).to.have.rendered.text('John');
        expect(grid.getBodyCellContent(1, 1)).to.have.rendered.text('Dove');
      });

      it('does not pass its own parameters to the underlying grid', async () => {
        const grid = await GridController.init(render(<TestAutoGridNoHeaderFilters />), user);
        expect(grid.instance.getAttribute('model')).to.be.null;
        expect(grid.instance.getAttribute('service')).to.be.null;
      });

      it('calls data provider list() only once for initial data', async () => {
        const testService = personService();
        expect(testService.callCount).to.equal(0);
        await GridController.init(render(<AutoGrid service={testService} model={PersonModel} />), user);
        expect(testService.callCount).to.equal(1);
      });

      it('passes filter to the data provider', async () => {
        const filter: PropertyStringFilter = { filterValue: 'Jan', matcher: Matcher.CONTAINS, propertyId: 'firstName' };
        // @ts-expect-error: getting internal property
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        filter.t = 'propertyString'; // Workaround for https://github.com/vaadin/hilla/issues/438

        const grid = await GridController.init(render(<TestAutoGrid experimentalFilter={filter} />), user);
        expect(grid.getVisibleRowCount()).to.equal(1);
        expect(grid.getBodyCellContent(0, 0)).to.have.rendered.text('Jane');
        expect(grid.getBodyCellContent(0, 1)).to.have.rendered.text('Love');
      });

      describe('multi-sort', () => {
        let grid: GridController;
        let service: CrudService<Person> & HasTestInfo;

        function TestAutoGridWithMultiSort(customProps: Partial<AutoGridProps<Person>>) {
          return (
            <AutoGrid
              service={personService()}
              model={PersonModel}
              noHeaderFilters
              multiSort
              multiSortPriority="append"
              {...customProps}
            ></AutoGrid>
          );
        }

        beforeEach(async () => {
          service = personService();
          grid = await GridController.init(render(<TestAutoGridWithMultiSort service={service} />), user);
        });

        it('sorts according to first column by default', async () => {
          expect(service.lastSort).to.deep.equal({
            orders: [{ property: 'firstName', direction: Direction.ASC, ignoreCase: false }],
          });

          await expect(grid.getSortOrder()).to.eventually.deep.equal([
            { property: 'firstName', direction: Direction.ASC },
          ]);
        });

        it('sorts by multiple columns', async () => {
          await grid.sort('lastName', 'asc');
          expect(service.lastSort).to.deep.equal({
            orders: [
              { property: 'firstName', direction: Direction.ASC, ignoreCase: false },
              { property: 'lastName', direction: Direction.ASC, ignoreCase: false },
            ],
          });

          await expect(grid.getSortOrder()).to.eventually.deep.equal([
            { property: 'firstName', direction: Direction.ASC },
            { property: 'lastName', direction: Direction.ASC },
          ]);

          await grid.sort('lastName', 'desc');
          expect(service.lastSort).to.deep.equal({
            orders: [
              { property: 'firstName', direction: Direction.ASC, ignoreCase: false },
              { property: 'lastName', direction: Direction.DESC, ignoreCase: false },
            ],
          });

          await expect(grid.getSortOrder()).to.eventually.deep.equal([
            { property: 'firstName', direction: Direction.ASC },
            { property: 'lastName', direction: Direction.DESC },
          ]);

          await grid.sort('lastName', null);
          expect(service.lastSort).to.deep.equal({
            orders: [{ property: 'firstName', direction: Direction.ASC, ignoreCase: false }],
          });

          await expect(grid.getSortOrder()).to.eventually.deep.equal([
            { property: 'firstName', direction: Direction.ASC },
          ]);
        });
      });

      describe('header filters', () => {
        it('created for string columns', async () => {
          const grid = await GridController.init(render(<TestAutoGrid />), user);
          const cell = grid.getHeaderCellContent(1, 0);
          expect(cell.firstElementChild?.localName).to.equal('vaadin-text-field');
        });

        it('created for number columns', async () => {
          const grid = await GridController.init(render(<TestAutoGrid />), user);
          const cell = grid.getHeaderCellContent(1, 3);
          expect(cell.firstElementChild?.localName).to.equal('vaadin-select');
        });

        it('filter when you type in the field for a string column', async () => {
          const service = personService();
          const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);

          const firstNameFilterField = grid.getHeaderCellContent(1, 0).firstElementChild as TextFieldElement;
          firstNameFilterField.value = 'filter-value';
          firstNameFilterField.dispatchEvent(new CustomEvent('input'));
          await nextFrame();

          const expectedPropertyFilter: PropertyStringFilter = {
            ...{ t: 'propertyString' },
            filterValue: 'filter-value',
            propertyId: 'firstName',
            matcher: Matcher.CONTAINS,
          };
          const expectedFilter: AndFilter = { ...{ t: 'and' }, children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);
        });

        it('filter when you type in the field for a number column', async () => {
          const service = personService();
          const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);
          const someNumberFilter = grid.getHeaderCellContent(1, 3);
          const [someNumberFilterField, someNumberFieldSelect] = await Promise.all([
            TextFieldController.initByParent(someNumberFilter, user, 'vaadin-number-field'),
            SelectController.init(someNumberFilter, user),
          ]);
          await someNumberFilterField.type('123');

          const expectedPropertyFilter: PropertyStringFilter & { t: string } = {
            t: 'propertyString',
            filterValue: '123',
            propertyId: 'someNumber',
            matcher: Matcher.GREATER_THAN,
          };
          const expectedFilter: AndFilter & { t: string } = { t: 'and', children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);

          await someNumberFieldSelect.select(Matcher.EQUALS);

          const expectedPropertyFilter2: PropertyStringFilter & { t: string } = {
            t: 'propertyString',
            filterValue: '123',
            propertyId: 'someNumber',
            matcher: Matcher.EQUALS,
          };

          const expectedFilter2: AndFilter & { t: string } = { t: 'and', children: [expectedPropertyFilter2] };
          expect(service.lastFilter).to.deep.equal(expectedFilter2);
        });

        it('filters for a boolean column', async () => {
          const service = personService();
          const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);
          const controller = await SelectController.init(grid.getHeaderCellContent(1, 4), user);
          await controller.select('True');

          const expectedPropertyFilter: PropertyStringFilter = {
            ...{ t: 'propertyString' },
            filterValue: 'True',
            propertyId: 'vip',
            matcher: Matcher.EQUALS,
          };
          const expectedFilter: AndFilter = { ...{ t: 'and' }, children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);

          await controller.select('False');

          const expectedPropertyFilter2: PropertyStringFilter = {
            ...{ t: 'propertyString' },
            filterValue: 'False',
            propertyId: 'vip',
            matcher: Matcher.EQUALS,
          };
          const expectedFilter2: AndFilter = { ...{ t: 'and' }, children: [expectedPropertyFilter2] };
          expect(service.lastFilter).to.deep.equal(expectedFilter2);
        });

        it('combine filters (and) when you type in multiple fields', async () => {
          const service = personService();
          const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);
          const firstNameFilterField = await TextFieldController.initByParent(grid.getHeaderCellContent(1, 0), user);
          await firstNameFilterField.type('filterFirst');
          const lastNameFilterField = await TextFieldController.initByParent(grid.getHeaderCellContent(1, 1), user);
          await lastNameFilterField.type('filterLast');

          const expectedFirstNameFilter: PropertyStringFilter = {
            ...{ t: 'propertyString' },
            filterValue: 'filterFirst',
            propertyId: 'firstName',
            matcher: Matcher.CONTAINS,
          };
          const expectedLastNameFilter: PropertyStringFilter = {
            ...{ t: 'propertyString' },
            filterValue: 'filterLast',
            propertyId: 'lastName',
            matcher: Matcher.CONTAINS,
          };
          const expectedFilter: AndFilter = {
            ...{ t: 'and' },
            children: [expectedFirstNameFilter, expectedLastNameFilter],
          };
          expect(service.lastFilter).to.deep.equal(expectedFilter);
        });
        it('removes filters if turning header filters off', async () => {
          const service = personService();
          const result = render(<TestAutoGrid service={service} model={PersonModel} />);
          let grid = await GridController.init(result, user);
          expect(grid.getHeaderRows().length).to.equal(2);

          const companyNameFilter = await TextFieldController.initByParent(grid.getHeaderCellContent(1, 0), user);
          await companyNameFilter.type('Joh');

          const filter: PropertyStringFilter = {
            ...{ t: 'propertyString' },
            filterValue: 'Joh',
            matcher: Matcher.CONTAINS,
            propertyId: 'firstName',
          };
          const expectedFilter1: AndFilter = {
            ...{ t: 'and' },
            children: [filter],
          };
          expect(service.lastFilter).to.deep.equal(expectedFilter1);

          result.rerender(<AutoGrid service={service} model={PersonModel} noHeaderFilters />);
          grid = await GridController.init(result, user);
          expect(grid.getHeaderRows().length).to.equal(1);

          const expectedFilter2: AndFilter = {
            ...{ t: 'and' },
            children: [],
          };
          expect(service.lastFilter).to.deep.equal(expectedFilter2);
        });

        it('filters correctly after changing model', async () => {
          const _personService = personService();
          const _companyService = companyService();

          const result = render(<AutoGrid service={_personService} model={PersonModel} />);
          await GridController.init(result, user);
          result.rerender(<AutoGrid service={_companyService} model={CompanyModel} />);
          const grid = await GridController.init(result, user);

          const companyNameFilter = await TextFieldController.initByParent(grid.getHeaderCellContent(1, 0), user);
          await companyNameFilter.type('vaad');

          const expectedPropertyFilter: PropertyStringFilter = {
            ...{ t: 'propertyString' },
            filterValue: 'vaad',
            propertyId: 'name',
            matcher: Matcher.CONTAINS,
          };
          const expectedFilter: AndFilter = { ...{ t: 'and' }, children: [expectedPropertyFilter] };
          expect(_personService.lastFilter).to.deep.equal(expectedFilter);
        });
      });

      it('removes the filters when you clear the fields', async () => {
        const service = personService();
        const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);
        const [firstNameFilter, lastNameFilter] = await Promise.all([
          TextFieldController.initByParent(grid.getHeaderCellContent(1, 0), user),
          TextFieldController.initByParent(grid.getHeaderCellContent(1, 1), user),
        ]);
        await firstNameFilter.type('filterFirst');
        await lastNameFilter.type('filterLast');

        const expectedFilter: AndFilter = {
          ...{ t: 'and' },
          children: [],
        };
        expect(service.lastFilter).not.to.deep.equal(expectedFilter);

        await firstNameFilter.type('[Delete]');
        await lastNameFilter.type('[Delete]');
        expect(service.lastFilter).to.deep.equal(expectedFilter);
      });
    });

    describe('customize columns', () => {
      it('should only show configured columns in specified order', async () => {
        const grid = await GridController.init(render(<TestAutoGrid visibleColumns={['email', 'firstName']} />), user);
        await assertColumns(grid, 'email', 'firstName');
      });

      it('should show columns that would be excluded by default', async () => {
        const grid = await GridController.init(render(<TestAutoGrid visibleColumns={['id', 'version']} />), user);
        await assertColumns(grid, 'id', 'version');
      });

      it('should ignore unknown columns', async () => {
        const grid = await GridController.init(
          render(<TestAutoGrid visibleColumns={['foo', 'email', 'bar', 'firstName']} />),
          user,
        );
        await assertColumns(grid, 'email', 'firstName');
      });

      it('renders custom columns at the end', async () => {
        const NameRenderer = ({ item }: { item: Person }): JSX.Element => (
          <span>
            {item.firstName} {item.lastName}
          </span>
        );
        const grid = await GridController.init(
          render(
            <TestAutoGrid
              customColumns={[<GridColumn key="test-column" autoWidth renderer={NameRenderer}></GridColumn>]}
            />,
          ),
          user,
        );
        await assertColumns(grid, 'firstName', 'lastName', 'email', 'someNumber', 'vip', '');
        expect(grid.getBodyCellContent(0, 5)).to.have.rendered.text('Jane Love');
      });

      it('uses custom column options on top of the type defaults', async () => {
        const NameRenderer = ({ item }: { item: Person }): JSX.Element => <span>{item.firstName.toUpperCase()}</span>;
        const grid = await GridController.init(
          render(<TestAutoGrid columnOptions={{ firstName: { renderer: NameRenderer } }} />),
          user,
        );
        await assertColumns(grid, 'firstName', 'lastName', 'email', 'someNumber', 'vip');
        const janeCell = grid.getBodyCellContent(0, 0);
        expect(janeCell).to.have.rendered.text('JANE');
        // The header filter was not overridden
        const cell = grid.getHeaderCellContent(1, 0);
        expect(cell.firstElementChild).to.have.tagName('vaadin-text-field');
      });

      it('respects the header setting from custom column options', async () => {
        // With header filters
        let result = render(<TestAutoGrid columnOptions={{ firstName: { header: 'FIRSTNAME' } }} />);
        let grid = await GridController.init(result, user);
        expect(grid.getHeaderCellContent(0, 0).innerText).to.equal('FIRSTNAME');

        // Without header filters
        result.unmount();
        result = render(<TestAutoGrid noHeaderFilters columnOptions={{ firstName: { header: 'FIRSTNAME' } }} />);
        grid = await GridController.init(result, user);
        expect(grid.getHeaderCellContent(0, 0).innerText).to.equal('FIRSTNAME');
      });

      it('renders row numbers if requested', async () => {
        const grid = await GridController.init(render(<TestAutoGrid rowNumbers />), user);
        await assertColumns(grid, '', 'firstName', 'lastName', 'email', 'someNumber', 'vip');
        expect(grid.getBodyCellContent(0, 0)).to.have.rendered.text('1');
      });
    });

    describe('default renderers', () => {
      let grid: GridController;

      beforeEach(async () => {
        grid = await GridController.init(
          render(<AutoGrid service={columnRendererTestService()} model={ColumnRendererTestModel}></AutoGrid>),
          user,
        );
      });

      it('renders strings without formatting and with default alignment', () => {
        expect(grid.getBodyCellContent(0, 0)).to.have.style('text-align', 'start');
        expect(grid.getBodyCellContent(0, 0)).to.have.rendered.text('Hello World 1');
        expect(grid.getBodyCellContent(1, 0)).to.have.rendered.text('Hello World 2');
      });

      it('renders numbers as right aligned numbers', () => {
        expect(grid.getBodyCellContent(0, 1)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, 1)).to.have.rendered.text('123,456');
        expect(grid.getBodyCellContent(1, 1)).to.have.rendered.text('-12');
      });

      it('renders booleans as icons', () => {
        expect(grid.getBodyCellContent(0, 2).querySelector('vaadin-icon')).to.have.attribute('icon', 'lumo:checkmark');
        expect(grid.getBodyCellContent(1, 2).querySelector('vaadin-icon')).to.have.attribute('icon', 'lumo:minus');
      });

      it('renders java.util.Date as right aligned', () => {
        expect(grid.getBodyCellContent(0, 3)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, 3)).to.have.text('5/13/2021');
        expect(grid.getBodyCellContent(1, 3)).to.have.text('5/14/2021');
        expect(grid.getBodyCellContent(2, 3)).to.have.text('');
        expect(grid.getBodyCellContent(3, 3)).to.have.text('');
      });

      it('renders java.time.LocalDate as right aligned', () => {
        expect(grid.getBodyCellContent(0, 4)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, 4)).to.have.text('5/13/2021');
        expect(grid.getBodyCellContent(1, 4)).to.have.text('5/14/2021');
        expect(grid.getBodyCellContent(2, 4)).to.have.text('');
        expect(grid.getBodyCellContent(3, 4)).to.have.text('');
      });

      it('renders java.time.LocalTime as right aligned', () => {
        expect(grid.getBodyCellContent(0, 5)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, 5)).to.have.text('8:45 AM');
        expect(grid.getBodyCellContent(1, 5)).to.have.text('8:45 PM');
        expect(grid.getBodyCellContent(2, 5)).to.have.text('');
        expect(grid.getBodyCellContent(3, 5)).to.have.text('');
      });

      it('renders java.time.LocalDateTime as right aligned', () => {
        expect(grid.getBodyCellContent(0, 6)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, 6)).to.have.text('5/13/2021, 8:45 AM');
        expect(grid.getBodyCellContent(1, 6)).to.have.text('5/14/2021, 8:45 PM');
        expect(grid.getBodyCellContent(2, 6)).to.have.text('');
        expect(grid.getBodyCellContent(3, 6)).to.have.text('');
      });

      it('renders nested strings without formatting and with default alignment', () => {
        expect(grid.getBodyCellContent(0, 7)).to.have.style('text-align', 'start');
        expect(grid.getBodyCellContent(0, 7)).to.have.rendered.text('Nested string 1');
        expect(grid.getBodyCellContent(1, 7)).to.have.rendered.text('');
      });

      it('renders nested numbers as right aligned numbers', () => {
        expect(grid.getBodyCellContent(0, 8)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, 8)).to.have.rendered.text('123,456');
        expect(grid.getBodyCellContent(1, 8)).to.have.rendered.text('');
      });

      it('renders nested booleans as icons', () => {
        expect(grid.getBodyCellContent(0, 9).querySelector('vaadin-icon')).to.have.attribute('icon', 'lumo:checkmark');
        expect(grid.getBodyCellContent(1, 9).querySelector('vaadin-icon')).to.have.attribute('icon', 'lumo:minus');
      });

      it('renders java.util.Date as right aligned', () => {
        expect(grid.getBodyCellContent(0, 10)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, 10)).to.have.text('5/13/2021');
        expect(grid.getBodyCellContent(1, 10)).to.have.text('');
      });
    });
  });
});