package com.formatforge.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KugouPlugin.class);
        registerPlugin(SaveFilePlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(OpenExternalPlugin.class);
        super.onCreate(savedInstanceState);
    }
}