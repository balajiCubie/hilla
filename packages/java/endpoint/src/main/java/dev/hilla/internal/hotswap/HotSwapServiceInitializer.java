/*
 * Copyright 2000-2023 Vaadin Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

package dev.hilla.internal.hotswap;

import com.vaadin.flow.internal.BrowserLiveReload;
import com.vaadin.flow.internal.BrowserLiveReloadAccessor;
import com.vaadin.flow.server.ServiceInitEvent;
import com.vaadin.flow.server.VaadinService;
import com.vaadin.flow.server.VaadinServiceInitListener;

import java.nio.file.Path;

class HotSwapServiceInitializer implements VaadinServiceInitListener {

    private final HotSwapWatchService hotSwapWatchService;

    public HotSwapServiceInitializer(HotSwapWatchService hotSwapWatchService) {
        this.hotSwapWatchService = hotSwapWatchService;
    }

    @Override
    public void serviceInit(ServiceInitEvent serviceInitEvent) {
        VaadinService vaadinService = serviceInitEvent.getSource();
        BrowserLiveReloadAccessor.getLiveReloadFromService(vaadinService)
                .ifPresent(browserLiveReload -> {
                    if (BrowserLiveReload.Backend.SPRING_BOOT_DEVTOOLS != browserLiveReload
                            .getBackend() && isHotSwapEnabled(vaadinService)) {
                        hotSwapWatchService.watch(getClassesDir(vaadinService),
                                browserLiveReload);
                    }
                });
    }

    private boolean isHotSwapEnabled(VaadinService vaadinService) {
        return vaadinService.getDeploymentConfiguration()
                .isDevModeLiveReloadEnabled();
    }

    private Path getClassesDir(VaadinService vaadinService) {
        var deploymentConfig = vaadinService.getDeploymentConfiguration();
        var projectFolder = deploymentConfig.getProjectFolder().toPath();
        return projectFolder.resolve(deploymentConfig.getBuildFolder())
                .resolve("classes");
    }
}