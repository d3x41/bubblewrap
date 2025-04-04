// Portions (c) Meta Platforms, Inc. and affiliates.
/*
 * Copyright 2020 Google Inc. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {Feature, Metadata} from './Feature';
import {AppsFlyerFeature} from './AppsFlyerFeature';
import {LocationDelegationFeature} from './LocationDelegationFeature';
import {PlayBillingFeature} from './PlayBillingFeature';
import {HorizonBillingFeature} from './HorizonBillingFeature';
import {HorizonPlatformSDKFeature} from './HorizonPlatformSDKFeature';
import {TwaManifest} from '../TwaManifest';
import {FirstRunFlagFeature} from './FirstRunFlagFeature';
import {Log, ConsoleLog} from '../Log';
import {ArCoreFeature} from './ArCoreFeature';

const ANDROID_BROWSER_HELPER_VERSIONS = {
  stable: 'com.meta.androidbrowserhelper:androidbrowserhelper:2.5.0',
  alpha: 'com.meta.androidbrowserhelper:androidbrowserhelper:2.5.0',
};

/**
 * Analyzes a TwaManifest to collect enable features and aggregates all customizations that will
 * be applied when generating the Android project.
 */
export class FeatureManager {
  buildGradle = {
    repositories: new Set<string>(),
    dependencies: new Set<string>(),
  };
  androidManifest = {
    permissions: new Set<string>(),
    components: new Array<string>(),
    applicationMetadata: new Array<Metadata>(),
  };
  applicationClass = {
    imports: new Set<string>(),
    variables: new Array<string>(),
    onCreate: new Array<string>(),
  };
  launcherActivity = {
    imports: new Set<string>(),
    methods: new Set<string>(),
    variables: new Set<string>(),
    launchUrl: new Array<string>(),
  };
  delegationService = {
    imports: new Set<string>(),
    onCreate: new Array<string>(),
  };

  /**
   * Builds a new intance from a TwaManifest.
   */
  constructor(twaManifest: TwaManifest, log: Log = new ConsoleLog('FeatureManager')) {
    if (twaManifest.features.locationDelegation?.enabled) {
      this.addFeature(new LocationDelegationFeature());
    }

    if (twaManifest.features.playBilling?.enabled) {
      if (twaManifest.alphaDependencies?.enabled) {
        this.addFeature(new PlayBillingFeature());
      } else {
        log.error('Skipping PlayBillingFeature. '+
            'Enable alphaDependencies to add PlayBillingFeature.');
      }
    }

    if (twaManifest.features.horizonBilling?.enabled) {
      if (twaManifest.alphaDependencies?.enabled) {
        this.addFeature(new HorizonBillingFeature(twaManifest.features.horizonBilling));
      } else {
        log.error('Skipping HorizonBillingFeature. '+
            'Enable alphaDependencies to add HorizonBillingFeature.');
      }
    }

    if (twaManifest.features.horizonPlatformSDK?.enabled) {
      this.addFeature(new HorizonPlatformSDKFeature());
    }

    if (twaManifest.features.appsFlyer?.enabled) {
      this.addFeature(new AppsFlyerFeature(twaManifest.features.appsFlyer));
    }

    if (twaManifest.features.firstRunFlag?.enabled) {
      this.addFeature(new FirstRunFlagFeature(twaManifest.features.firstRunFlag));
    }

    // The WebView fallback needs the INTERNET permission.
    if (twaManifest.fallbackType === 'webview') {
      this.androidManifest.permissions.add('android.permission.INTERNET');
    }

    if (twaManifest.alphaDependencies?.enabled) {
      this.buildGradle.dependencies.add(ANDROID_BROWSER_HELPER_VERSIONS.alpha);
    } else {
      this.buildGradle.dependencies.add(ANDROID_BROWSER_HELPER_VERSIONS.stable);
    }

    if (twaManifest.features.arCore?.enabled) {
      this.addFeature(new ArCoreFeature());
    }

    // Android T+ needs permission to request sending notifications.
    if (twaManifest.enableNotifications) {
      this.androidManifest.permissions.add('android.permission.POST_NOTIFICATIONS');
    }
  }

  private addFeature(feature: Feature): void {
    // Adds properties to build.
    feature.buildGradle.repositories.forEach((repo) => {
      this.buildGradle.repositories.add(repo);
    });

    feature.buildGradle.dependencies.forEach((dep) => {
      this.buildGradle.dependencies.add(dep);
    });

    // Adds properties to application.
    feature.applicationClass.imports.forEach((imp) => {
      this.applicationClass.imports.add(imp);
    });
    feature.applicationClass.variables.forEach((imp) => {
      this.applicationClass.variables.push(imp);
    });
    if (feature.applicationClass.onCreate) {
      this.applicationClass.onCreate.push(feature.applicationClass.onCreate);
    }

    // Adds properties to AndroidManifest.xml.
    feature.androidManifest.permissions.forEach((permission) => {
      this.androidManifest.permissions.add(permission);
    });

    feature.androidManifest.components.forEach((component) => {
      this.androidManifest.components.push(component);
    });

    feature.androidManifest.applicationMetadata.forEach((metadata) => {
      this.androidManifest.applicationMetadata.push(metadata);
    });

    // Adds properties to launcherActivity.
    feature.launcherActivity.imports.forEach((imp) => {
      this.launcherActivity.imports.add(imp);
    });
    feature.launcherActivity.variables.forEach((imp) => {
      this.launcherActivity.variables.add(imp);
    });
    feature.launcherActivity.methods.forEach((imp) => {
      this.launcherActivity.methods.add(imp);
    });

    if (feature.launcherActivity.launchUrl) {
      this.launcherActivity.launchUrl.push(feature.launcherActivity.launchUrl);
    }

    // Adds properties to delegationService.
    feature.delegationService.imports.forEach((imp) => {
      this.delegationService.imports.add(imp);
    });

    if (feature.delegationService.onCreate) {
      this.delegationService.onCreate.push(feature.delegationService.onCreate);
    }
  }
}
