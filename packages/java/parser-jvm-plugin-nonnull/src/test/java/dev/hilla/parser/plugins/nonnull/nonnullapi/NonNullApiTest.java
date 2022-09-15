package dev.hilla.parser.plugins.nonnull.nonnullapi;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Set;

import org.junit.jupiter.api.Test;

import dev.hilla.parser.core.ParserConfig;
import dev.hilla.parser.plugins.backbone.BackbonePlugin;
import dev.hilla.parser.plugins.nonnull.AnnotationMatcher;
import dev.hilla.parser.plugins.nonnull.NonnullPlugin;
import dev.hilla.parser.plugins.nonnull.NonnullPluginConfig;
import dev.hilla.parser.plugins.nonnull.test.helpers.TestHelper;

public class NonNullApiTest {
    private final TestHelper helper = new TestHelper(getClass());

    @Test
    public void should_ApplyNonNullApiAnnotation()
            throws IOException, URISyntaxException {
        var plugin = new NonnullPlugin();
        plugin.setConfig(new NonnullPluginConfig(Set.of(
                new AnnotationMatcher(NonNullApi.class.getName(), false, 10),
                new AnnotationMatcher(NullableField.class.getName(), true, 20),
                new AnnotationMatcher(NullableMethod.class.getName(), true, 20),
                new AnnotationMatcher(NullableParameter.class.getName(), true,
                        20),
                new AnnotationMatcher(NullableSignature.class.getName(), true,
                        20)),
                null));

        var config = new ParserConfig.Builder()
                .classPath(Set.of(helper.getTargetDir().toString()))
                .endpointAnnotation(Endpoint.class.getName())
                .addPlugin(new BackbonePlugin()).addPlugin(plugin).finish();

        helper.executeParserWithConfig(config);
    }
}