/* eslint-disable import/no-extraneous-dependencies */
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import BackbonePlugin from '../../src/index.js';
import { createGenerator, loadInput, pathBase } from '../utils/common.js';
import snapshotMatcher from '../utils/snapshotMatcher.js';

use(sinonChai);
use(snapshotMatcher);

describe('BackbonePlugin', () => {
  context('when there is an enum entity', () => {
    const sectionName = 'EnumType';
    const modelSectionPath = `${pathBase}/${sectionName.toLowerCase()}/${sectionName}Endpoint`;

    it('correctly generates code', async () => {
      const generator = createGenerator([BackbonePlugin]);
      const input = await loadInput(sectionName, import.meta.url);
      const files = await generator.process(input);
      expect(files.length).to.equal(3);

      const [barrelFile, endpointFile, enumEntity] = files;
      await expect(await barrelFile.text()).toMatchSnapshot('barrel', import.meta.url);
      await expect(await endpointFile.text()).toMatchSnapshot(`${sectionName}Endpoint`, import.meta.url);
      await expect(await enumEntity.text()).toMatchSnapshot('EnumEntity.entity', import.meta.url);
      expect(barrelFile.name).to.equal(`./endpoints.ts`);
      expect(endpointFile.name).to.equal(`./${sectionName}Endpoint.ts`);
      expect(enumEntity.name).to.equal(`${modelSectionPath}/EnumEntity.ts`);
    });
  });
});